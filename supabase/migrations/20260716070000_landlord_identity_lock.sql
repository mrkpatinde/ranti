-- ADR-002 — Identité propriétaire verrouillée.
--
-- Contexte (audit prod 2026-07-15, projet pcxkxeesgusorrpmrkaj) :
--   `public.landlords` ne portait que `landlords_audit` (AFTER) et
--   `landlords_set_updated_at` (BEFORE). La policy `landlords_update_own`
--   vérifie `auth_user_id = auth.uid()` mais PAS l'immutabilité de
--   `first_name` / `last_name` / `civility` / `phone`. Un propriétaire
--   authentifié pouvait donc réécrire son propre nom / téléphone directement
--   en base : « verrouillé en UI, modifiable en DB = fausse sécurité ».
--
-- Décision ADR-002 (implémentée ici) :
--   1. Au repos, la base REJETTE tout changement des colonnes d'identité par un
--      rôle client (authenticated / anon).
--   2. Le seul changement légitime de nom / civilité passe par un flux RPC
--      SECURITY DEFINER explicite exigeant un motif, qui écrit un `audit_logs`
--      dans la MÊME transaction (ADR-006, fail-closed).
--   3. Le téléphone est l'identifiant de connexion (auth phone+password).
--      Le modifier touche l'authentification -> flux de re-vérification dédié,
--      hors scope MVP. Bloqué inconditionnellement ici (aucun paramètre phone
--      dans le RPC + rejet trigger), quel que soit le rôle.
--
-- Mécanisme (non contournable côté client) :
--   Trigger BEFORE UPDATE en SECURITY INVOKER : il observe donc `current_user`
--   RÉEL de l'instruction. PostgREST pose `current_user` = `authenticated` /
--   `anon`. Une écriture directe du client tombe sous ce rôle -> rejet. Le RPC
--   ci-dessous est SECURITY DEFINER (propriétaire `postgres`) : à l'intérieur,
--   `current_user` n'est plus un rôle client, donc son UPDATE d'identité passe.
--   Un rôle client ne peut ni forger `current_user` ni créer une fonction
--   DEFINER exploitable (elle serait détenue par lui-même = toujours un rôle
--   client). Pas de GUC spoofable, pas de révocation de privilège table (le
--   grant UPDATE existant de `authenticated` — utilisé pour payment_alias et
--   l'archive deleted_at — reste intact ; cf. authenticated_grants.test.sql).
--
-- Colonnes mutables `authenticated` (inchangées, non-identité) :
--   deleted_at (archive/restore 007), payment_alias / _type (20260705140000).
-- L'identité n'est jamais réécrite par le code applicatif après l'onboarding
-- (onboarding = INSERT, hors d'un trigger BEFORE UPDATE).

begin;

-- ---------------------------------------------------------------------------
-- 1. Trigger BEFORE UPDATE — verrou identité (SECURITY INVOKER volontaire).
-- ---------------------------------------------------------------------------

create or replace function private.enforce_landlord_identity_lock()
returns trigger
language plpgsql
security invoker            -- doit voir le current_user réel de l'appelant
set search_path = ''
as $$
begin
  -- Le téléphone est l'identifiant de connexion : jamais un simple update,
  -- quel que soit le rôle (invariant fort, aucun flux légitime aujourd'hui).
  if new.phone is distinct from old.phone then
    raise exception 'landlord_phone_change_forbidden'
      using errcode = 'P0001',
            hint = 'Téléphone = identifiant de connexion : flux de re-vérification dédié requis (ADR-002).';
  end if;

  -- Nom / civilité : un rôle client (authenticated/anon) ne peut PAS les écrire
  -- directement. Le seul chemin est public.update_landlord_identity(), qui
  -- s'exécute en DEFINER (current_user non client) et audite le changement.
  if (new.first_name is distinct from old.first_name
      or new.last_name is distinct from old.last_name
      or new.civility  is distinct from old.civility)
     and current_user in ('authenticated', 'anon') then
    raise exception 'landlord_identity_locked'
      using errcode = 'P0001',
            hint = 'Identité verrouillée (ADR-002) : passez par public.update_landlord_identity(...).';
  end if;

  return new;
end;
$$;

-- Trigger seulement déclenché quand une colonne d'identité est ciblée par le SET
-- (les updates payment_alias / deleted_at ne le réveillent pas).
drop trigger if exists landlords_identity_lock on public.landlords;
create trigger landlords_identity_lock
  before update of first_name, last_name, civility, phone on public.landlords
  for each row execute function private.enforce_landlord_identity_lock();

-- ---------------------------------------------------------------------------
-- 2. RPC identité — seul chemin légitime, audité dans la même transaction.
--    SECURITY DEFINER (propriétaire postgres) : son UPDATE franchit le trigger
--    (current_user non client) et le RLS. Le téléphone n'est pas un paramètre
--    (hors scope MVP).
-- ---------------------------------------------------------------------------

create or replace function public.update_landlord_identity(
  p_first_name text,
  p_last_name  text,
  p_civility   text,
  p_reason     text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_landlord_id uuid;
  v_old public.landlords%rowtype;
  v_first text := btrim(p_first_name);
  v_last  text := btrim(p_last_name);
begin
  v_landlord_id := private.current_landlord_id();
  if v_landlord_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Motif obligatoire (ADR-002 / ADR-006).
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'identity_change_reason_required' using errcode = 'P0001';
  end if;

  -- Validation des champs.
  if v_first is null or v_first = '' then
    raise exception 'first_name_required' using errcode = 'P0001';
  end if;
  if v_last is null or v_last = '' then
    raise exception 'last_name_required' using errcode = 'P0001';
  end if;
  if p_civility is not null
     and p_civility not in ('mr', 'mrs', 'miss', 'not_specified') then
    raise exception 'invalid_civility' using errcode = 'P0001';
  end if;

  select * into v_old
  from public.landlords
  where id = v_landlord_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'landlord_not_found' using errcode = 'P0001';
  end if;

  -- No-op : rien à auditer si l'identité est inchangée.
  if v_old.first_name is not distinct from v_first
     and v_old.last_name is not distinct from v_last
     and v_old.civility  is not distinct from p_civility then
    return v_landlord_id;
  end if;

  update public.landlords
  set first_name = v_first,
      last_name  = v_last,
      civility   = p_civility
  where id = v_landlord_id;

  -- Audit dans la MÊME transaction (ADR-006). Si l'audit échoue, l'UPDATE
  -- ci-dessus est annulé (rollback) : pas de mutation d'identité sans trace.
  perform private.write_audit(
    v_landlord_id,
    v_landlord_id,
    'update_landlord_identity',
    'landlords',
    v_landlord_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'first_name', v_old.first_name,
        'last_name',  v_old.last_name,
        'civility',   v_old.civility
      ),
      'after', jsonb_build_object(
        'first_name', v_first,
        'last_name',  v_last,
        'civility',   p_civility
      ),
      'reason', btrim(p_reason)
    )
  );

  return v_landlord_id;
end;
$$;

-- GRANT explicite (leçon récurrente « policy correcte + GRANT oublié ») :
-- le propriétaire authentifié appelle le RPC ; anon/public jamais.
revoke all on function public.update_landlord_identity(text, text, text, text)
  from public, anon;
grant execute on function public.update_landlord_identity(text, text, text, text)
  to authenticated;

commit;
