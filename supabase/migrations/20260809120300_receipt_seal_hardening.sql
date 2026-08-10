-- ============================================================
-- 20260809120300 — Sceau de quittance : HMAC sous secret serveur + verrou d'écriture
-- ============================================================
-- Faille corrigée (constatée le 2026-08-09) :
--
--   Depuis 20260727120000, le sceau est posé à l'émission par la recette
--   UNIQUE private.receipt_computed_fingerprint — mais cette recette était
--   sha256(receipt_number || issued_at || snapshot), SANS secret. Le rôle
--   `authenticated` disposant de INSERT et UPDATE sur public.receipts, un
--   gestionnaire pouvait écrire directement, via PostgREST, une quittance
--   portant tenant_ack = 'certified' et l'empreinte correspondante — qu'il
--   pouvait calculer lui-même. La page /verifier affichait alors « intègre »
--   pour une certification locataire inventée.
--
--   La certification par le locataire est l'argument central du produit
--   (CGU art. 7 : « la confirmation par le Locataire renforce la valeur
--   probante du document »). Elle doit être infalsifiable par l'émetteur.
--
-- Correction en trois temps, qui COMPOSE avec l'architecture de
-- 20260727120000 (scellement à l'émission, source unique) au lieu de la
-- remplacer :
--   1. le CORPS de private.receipt_computed_fingerprint devient un
--      HMAC-SHA256 sous secret serveur. Signature, nom et emplacement
--      inchangés : ses quatre appelants (generate_receipt_core,
--      certify_receipt_by_token, verify_receipt_integrity,
--      verify_receipt_by_number) continuent de fonctionner sans modification,
--      et le verdict reste rendu par comparaison stored/computed ;
--   2. un trigger interdit à un client d'écrire lui-même les colonnes de
--      certification, et recalcule côté serveur l'empreinte de tout INSERT
--      client — une valeur forgée est écrasée, le scellement à l'émission
--      est préservé ;
--   3. le jeton locataire sort de la portée de lecture du gestionnaire : il
--      s'obtient par une fonction qui journalise chaque accès.
--
-- CE QUE CETTE MIGRATION CHANGE À LA DÉCISION DE 20260727120000 : le sceau
-- passe de « opposable au tiers, pas à l'éditeur » à « opposable à l'ÉDITEUR
-- pour le CONTENU ». L'émetteur ne peut plus recalculer l'empreinte hors base
-- (le secret ne sort jamais du schéma private), ni écrire les colonnes de
-- certification, ni modifier un contenu émis. Un document altéré ressort
-- « tampered » quels que soient les privilèges API de son auteur.
--
-- LIMITE RESTANTE, à ne pas surinterpréter. Le locataire n'a pas de compte :
-- il reçoit un lien que le gestionnaire lui transmet. Un gestionnaire
-- déterminé peut donc récupérer ce lien (via receipt_share_token) et cliquer
-- à la place de son locataire. Le sceau prouve que le contenu n'a pas été
-- altéré depuis l'émission et que la certification est passée par le parcours
-- à jeton ; il ne prouve pas l'identité du cliqueur — c'est déjà ce qu'énonce
-- ADR-013 §4. Chaque remise du lien est journalisée dans audit_logs : la
-- manœuvre est traçable, pas empêchable. La rendre impossible suppose un code
-- à usage unique envoyé au numéro du locataire — un arbitrage produit
-- (friction contre valeur probante), pas un correctif technique.
--
-- Les quittances existantes (TOUTES les non-supprimées : la base scelle tout
-- à l'émission depuis 20260727120010) sont rescellées sous la nouvelle
-- recette : leur contenu n'est pas modifié, seule l'empreinte est recalculée.
-- ============================================================

begin;

-- pgcrypto vit dans `extensions` en production et dans `public` sur une base
-- reconstruite localement : on couvre les deux sans qualifier les appels.
set local search_path = private, public, extensions;

-- ── 1. Secret serveur ───────────────────────────────────────────────────────
create table if not exists private.app_secrets (
  name       text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);

revoke all on private.app_secrets from public, anon, authenticated, service_role;

insert into private.app_secrets (name, value)
values ('receipt_seal', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

comment on table private.app_secrets is
  'Secrets serveur. Aucun rôle client n''y accède. Rotation : mettre à jour la
   valeur puis rejouer private.reseal_receipts().';

-- ── 2. La recette unique passe sous secret ──────────────────────────────────
-- MÊME nom, MÊME signature, MÊME emplacement que 20260727120000 : la source
-- unique reste unique, seul le CORPS change (HMAC au lieu de SHA-256 nu).
-- SECURITY DEFINER, nouveau : la fonction doit lire private.app_secrets, que
-- ses appelants SECURITY INVOKER (generate_receipt_core sous `authenticated`)
-- n'ont pas le droit de lire — et ne doivent jamais avoir. Le secret ne
-- transite que dans le corps de cette fonction. EXECUTE reste accordé à
-- authenticated (émission) : le schéma private n'étant pas exposé par
-- PostgREST, un client ne peut pas s'en servir d'oracle hors base.
create or replace function private.receipt_computed_fingerprint(
  p_receipt_number text,
  p_issued_at timestamptz,
  p_snapshot jsonb
)
returns text
language sql
stable
security definer
set search_path = private, public, extensions
as $$
  select encode(
    hmac(
      convert_to(
        p_receipt_number
          || to_char(p_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
          || p_snapshot::text,
        'UTF8'
      ),
      convert_to((select value from private.app_secrets where name = 'receipt_seal'), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function private.receipt_computed_fingerprint(text, timestamptz, jsonb) is
  'Recette UNIQUE de l''empreinte d''intégrité (ADR-013) : HMAC-SHA256 sous le '
  'secret private.app_secrets(receipt_seal). Toute fonction qui scelle ou '
  'revérifie DOIT passer par ici : deux recettes = deux verdicts possibles '
  'sur le même document.';

-- create or replace conserve les ACL ; on les réaffirme par convention maison.
revoke all on function private.receipt_computed_fingerprint(text, timestamptz, jsonb)
  from public, anon;
grant execute on function private.receipt_computed_fingerprint(text, timestamptz, jsonb)
  to authenticated, service_role;

-- ── 3. Verrou d'écriture sur les colonnes de certification ──────────────────
-- Le rôle courant est `authenticated` ou `anon` lors d'un appel PostgREST
-- direct, et le rôle propriétaire à l'intérieur d'une fonction SECURITY
-- DEFINER. C'est la distinction sur laquelle repose le verrou.
-- SECURITY INVOKER, délibérément : le verrou repose sur la lecture de
-- `current_user`. Sous SECURITY DEFINER, current_user vaudrait toujours le
-- propriétaire de la fonction et la garde ne se déclencherait jamais. Ici, il
-- vaut `authenticated` sur un appel PostgREST direct, et le propriétaire à
-- l'intérieur des RPC à jeton — c'est exactement la distinction recherchée.
-- NB : l'INSERT de private.generate_receipt_core (SECURITY INVOKER) passe LUI
-- AUSSI sous `authenticated` — c'est pourquoi l'INSERT client ne met pas
-- l'empreinte à null mais la RECALCULE : l'émission légitime reste scellée
-- (même valeur, recette déterministe), une valeur forgée est écrasée.
-- cancel_receipt est SECURITY INVOKER (014_receipts) : l'annulation par le
-- client DOIT rester possible — le passage issued -> cancelled avec
-- cancelled_at/cancellation_reason n'est donc pas bloqué ; seul le chemin
-- inverse (ressusciter une annulée) l'est.
create or replace function private.enforce_receipt_certification()
returns trigger
language plpgsql
security invoker
set search_path = private, public, extensions
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if v_client then
      -- Une quittance naît toujours unilatérale. La certification ne peut
      -- venir que du locataire, plus tard, par jeton.
      new.tenant_ack           := 'unilateral';
      new.tenant_certified_at  := null;
      new.tenant_read_at       := null;
      new.contested_at         := null;
      new.contest_nature       := null;
      new.contested_amount     := null;
      new.contested_period     := null;
      -- Le sceau est recalculé CÔTÉ SERVEUR, sous secret : toute empreinte
      -- fournie par le client est écrasée, l'émission reste scellée.
      new.sha256_fingerprint   := private.receipt_computed_fingerprint(
        new.receipt_number, new.issued_at, new.snapshot
      );
    end if;
    return new;
  end if;

  if v_client then
    if new.tenant_ack          is distinct from old.tenant_ack
       or new.tenant_certified_at is distinct from old.tenant_certified_at
       or new.tenant_read_at      is distinct from old.tenant_read_at
       or new.sha256_fingerprint  is distinct from old.sha256_fingerprint
       or new.contested_at        is distinct from old.contested_at
       or new.contest_nature      is distinct from old.contest_nature
       or new.contested_amount    is distinct from old.contested_amount
       or new.contested_period    is distinct from old.contested_period then
      raise exception 'receipt_certification_readonly'
        using errcode = '42501',
              hint = 'La certification locataire s''écrit uniquement via les RPC à jeton.';
    end if;

    -- L'annulation passe par cancel_receipt, qui pose status et cancelled_at
    -- ensemble. Rétablir 'issued' à la main ressusciterait une quittance
    -- annulée en conservant son sceau : interdit.
    if new.status is distinct from old.status and old.status = 'cancelled' then
      raise exception 'receipt_cancelled_is_final'
        using errcode = '42501',
              hint = 'Une quittance annulée ne se réactive pas : en émettre une nouvelle.';
    end if;

    if new.receipt_number is distinct from old.receipt_number
       or new.issued_at   is distinct from old.issued_at
       or new.snapshot    is distinct from old.snapshot
       or new.total_amount is distinct from old.total_amount
       or new.tenant_token is distinct from old.tenant_token then
      raise exception 'receipt_content_immutable'
        using errcode = '42501',
              hint = 'Une quittance émise ne se modifie pas : l''annuler et en émettre une nouvelle.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists receipts_certification_guard on public.receipts;
create trigger receipts_certification_guard
  before insert or update on public.receipts
  for each row execute function private.enforce_receipt_certification();

-- ── 4. Le lien locataire : accès journalisé ────────────────────────────────
-- Le gestionnaire a besoin du lien pour l'envoyer. Il ne l'obtient plus en
-- lisant la table : il le demande, et la demande laisse une trace dans
-- audit_logs. Une certification apparue sans qu'aucun lien n'ait été demandé
-- pour cette quittance devient une anomalie repérable.
--
-- ⚠️ Un `revoke select (tenant_token)` seul serait INOPÉRANT : authenticated
-- détient SELECT au niveau TABLE (20260714170000), qui couvre toutes les
-- colonnes ; une révocation par colonne ne retire rien à un privilège de
-- table. La révocation effective passe par : retrait du SELECT de table,
-- puis GRANT par colonne sur tout SAUF tenant_token. Conséquences assumées :
--   • `select *` sur receipts échoue désormais sous authenticated — le front
--     lit une liste explicite (RECEIPT_COLUMNS) ;
--   • une colonne ajoutée plus tard à receipts devra être GRANTÉE
--     explicitement à authenticated (elle n'hérite plus du privilège table) ;
--   • cancel_receipt et replace_receipt (SECURITY INVOKER) faisaient
--     `select * into %rowtype` : recréées ci-dessous à comportement
--     identique, sur les seules colonnes qu'elles utilisent ;
--   • journal_feed (security_invoker) exposait tenant_token en clair à tout
--     l'écran journal : recréée ci-dessous avec receipt_id à la place — le
--     front demande le lien via receipt_share_token au moment de l'envoi.
revoke select on public.receipts from authenticated;
grant select (
  id, landlord_id, rent_reception_id, receipt_number, issued_at,
  total_amount, currency, status, pdf_storage_path, cancelled_at,
  cancellation_reason, created_at, updated_at, deleted_at, snapshot,
  kind, replaces_receipt_id, tenant_ack, tenant_read_at,
  tenant_certified_at, contested_at, contest_nature, contested_amount,
  contested_period, sha256_fingerprint
) on public.receipts to authenticated;

-- cancel_receipt : comportement identique à 014_receipts, sans `select *`
-- (le rowtype embarquait tenant_token, désormais illisible par l'appelant).
create or replace function public.cancel_receipt(p_receipt_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  v_status text;
begin
  select r.status into v_status from public.receipts r
  where r.id = p_receipt_id and r.landlord_id = lid and r.deleted_at is null;
  if not found then raise exception 'receipt_not_found' using errcode = 'P0002'; end if;
  if v_status = 'cancelled' then return; end if;

  update public.receipts
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = p_receipt_id;
end;
$$;

revoke all on function public.cancel_receipt(uuid, text) from public, anon;
grant execute on function public.cancel_receipt(uuid, text) to authenticated;

-- replace_receipt : idem, colonnes explicites au lieu du rowtype complet.
create or replace function public.replace_receipt(p_receipt_id uuid, p_reason text)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  lid uuid := private.current_landlord_id();
  v_old_id uuid;
  v_old_status text;
  v_old_reception uuid;
  new_id uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  -- Ownership + verrou pour serialiser.
  select r.id, r.status, r.rent_reception_id
    into v_old_id, v_old_status, v_old_reception
  from public.receipts r
  where r.id = p_receipt_id and r.landlord_id = lid and r.deleted_at is null
  for update;
  if not found then raise exception 'receipt_not_found' using errcode = 'P0002'; end if;
  if v_old_status <> 'issued' then
    raise exception 'receipt_not_issued' using errcode = 'P0001';
  end if;

  -- Annule l'ancien (historique garde).
  update public.receipts
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = v_old_id;

  -- Genere le nouveau document actif pour la meme reception.
  -- (l'ancien etant annule, l'early-return ne le renvoie plus.)
  new_id := public.generate_receipt(v_old_reception);

  -- Lien nouveau -> ancien.
  update public.receipts set replaces_receipt_id = v_old_id where id = new_id;

  -- TODO(ADR-006) : write_audit('receipts','replace', old.id/new_id, {reason}).
  return new_id;
end;
$function$;

revoke all on function public.replace_receipt(uuid, text) from public, anon;
grant execute on function public.replace_receipt(uuid, text) to authenticated;

-- journal_feed : la colonne receipt_token devient receipt_id. La vue est
-- security_invoker : si elle continuait de référencer tenant_token, TOUTE
-- lecture du journal échouerait sous authenticated — et la laisser servir le
-- jeton en masse à chaque affichage viderait la journalisation de son sens.
-- Le nom de colonne change : drop + create + regrant obligatoires.
drop view if exists public.journal_feed;

create view public.journal_feed
with (security_invoker = true)
as
select
  l.landlord_id,
  'lease_started'::text                          as event_type,
  l.start_date::timestamptz                      as occurred_at,
  'Nouveau bail'::text                           as label,
  l.monthly_rent_amount                          as amount,
  l.currency,
  'leases'::text                                 as ref_table,
  l.id                                           as ref_id,
  nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), '') as counterparty,
  u.name                                         as unit_label,
  null::text                                     as reference,
  null::boolean                                  as allocated,
  t.phone                                        as counterparty_phone,
  null::uuid                                     as receipt_id
from public.leases l
left join public.tenants t on t.id = l.tenant_id
left join public.units u on u.id = l.unit_id
where l.deleted_at is null and l.status in ('active','ended')
union all
select
  d.landlord_id,
  'rent_due'::text,
  d.due_date::timestamptz,
  'Loyer attendu'::text,
  d.amount_due,
  d.currency,
  'rent_dues'::text,
  d.id,
  nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
  u.name,
  null::text,
  null::boolean,
  t.phone,
  null::uuid
from public.rent_dues d
left join public.tenants t on t.id = d.tenant_id
left join public.units u on u.id = d.unit_id
where d.deleted_at is null and d.status <> 'cancelled'
union all
select
  r.landlord_id,
  'rent_reception'::text,
  r.received_at,
  case
    when exists (select 1 from public.rent_reception_allocations a
                 where a.rent_reception_id = r.id)
    then 'Encaissement'::text
    else 'Encaissement non affecté'::text
  end,
  r.amount_received,
  r.currency,
  'rent_receptions'::text,
  r.id,
  nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
  u.name,
  r.payment_reference,
  exists (select 1 from public.rent_reception_allocations a
          where a.rent_reception_id = r.id),
  t.phone,
  q.id
from public.rent_receptions r
left join public.tenants t on t.id = r.tenant_id
left join public.units u on u.id = r.unit_id
left join public.receipts q
  on q.rent_reception_id = r.id and q.status = 'issued' and q.deleted_at is null
where r.deleted_at is null and r.status = 'confirmed'
union all
select
  q.landlord_id,
  'receipt'::text,
  q.issued_at,
  'Quittance émise'::text,
  q.total_amount,
  q.currency,
  'receipts'::text,
  q.id,
  nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
  u.name,
  null::text,
  null::boolean,
  t.phone,
  q.id
from public.receipts q
left join public.rent_receptions r on r.id = q.rent_reception_id
left join public.tenants t on t.id = r.tenant_id
left join public.units u on u.id = r.unit_id
where q.deleted_at is null and q.status = 'issued'
union all
select
  m.landlord_id,
  'reminder'::text,
  m.sent_at,
  'Relance envoyée'::text,
  null::integer,
  null::text,
  'reminders'::text,
  m.id,
  nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
  u.name,
  null::text,
  null::boolean,
  t.phone,
  null::uuid
from public.reminders m
left join public.rent_dues d on d.id = m.rent_due_id
left join public.tenants t on t.id = d.tenant_id
left join public.units u on u.id = d.unit_id
where m.status <> 'failed'
union all
select
  e.landlord_id,
  'reminder'::text,
  e.sent_at,
  'Relance envoyée'::text,
  null::integer,
  null::text,
  'reminder_events'::text,
  e.id,
  nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
  u.name,
  null::text,
  null::boolean,
  t.phone,
  null::uuid
from public.reminder_events e
left join public.tenants t on t.id = e.tenant_id
left join public.leases le on le.id = e.lease_id
left join public.units u on u.id = le.unit_id;

comment on view public.journal_feed is
  'Flux du journal (ADR-014), security_invoker : la RLS des tables sources '
  's''applique. Ne porte plus le jeton locataire : le lien /recu/[token] '
  's''obtient par receipt_share_token, qui journalise chaque remise.';

grant select on public.journal_feed to authenticated;

create or replace function public.receipt_share_token(p_receipt_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_landlord uuid := private.current_landlord_id();
  v_token    uuid;
begin
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;

  select r.tenant_token into v_token
  from public.receipts r
  where r.id = p_receipt_id
    and r.landlord_id = v_landlord
    and r.deleted_at is null;

  if v_token is null then
    raise exception 'receipt_not_found' using errcode = 'P0002';
  end if;

  perform private.write_audit(
    v_landlord, v_landlord, 'receipt.share_link_issued', 'receipts', p_receipt_id,
    jsonb_build_object('at', now())
  );

  return v_token;
end;
$$;

revoke all on function public.receipt_share_token(uuid) from public, anon;
grant execute on function public.receipt_share_token(uuid) to authenticated;

-- ── 5. Rescellement sous la nouvelle recette ────────────────────────────────
-- TOUTES les quittances non supprimées : la base scelle tout à l'émission
-- depuis 20260727120000 et a tout rétro-scellé en 20260727120010. Le contenu
-- ne bouge pas, seule l'empreinte est recalculée — le trigger receipts_audit
-- tracera ces écritures (voulu : une mutation de la table de preuve doit
-- rester lisible dans l'audit). La fonction reste disponible pour une
-- rotation ultérieure du secret.
create or replace function private.reseal_receipts()
returns integer
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare n integer;
begin
  update public.receipts r
  set sha256_fingerprint = private.receipt_computed_fingerprint(r.receipt_number, r.issued_at, r.snapshot)
  where r.deleted_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.reseal_receipts() from public, anon, authenticated;

do $$
declare n integer;
begin
  select private.reseal_receipts() into n;
  raise notice 'Quittances rescellées sous la recette HMAC : %', n;
end $$;

-- ── 6. Le commentaire de colonne suit la nouvelle recette ───────────────────
comment on column public.receipts.sha256_fingerprint is
  'Empreinte d''intégrité du contenu figé, scellée À L''ÉMISSION. Depuis '
  '2026-08-09 : HMAC-SHA256 sous secret serveur (private.app_secrets), '
  'incalculable hors base — opposable à l''éditeur pour le contenu. La '
  'certification reste la deuxième voix (ADR-013) : le sceau ne prouve pas '
  'l''identité du cliqueur du lien locataire.';

commit;
