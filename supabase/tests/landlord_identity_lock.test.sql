-- Test SQL — ADR-002 verrou identité propriétaire (migration 20260716070000).
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/landlord_identity_lock.test.sql
--
-- Prouve :
--   1. GRANTS — authenticated exécute le RPC ; anon non. Le privilège TABLE
--      UPDATE de authenticated reste intact (payment_alias + archive), donc
--      authenticated_grants.test.sql tient. Le trigger de verrou existe.
--   2. Chemin direct REJETÉ — sous le rôle authenticated, réécrire son nom lève
--      `landlord_identity_locked` et son téléphone `landlord_phone_change_forbidden` ;
--      la valeur reste inchangée.
--   3. Chemin RPC OK — update_landlord_identity change le nom ET écrit un
--      audit_logs `update_landlord_identity` porteur du motif, même transaction.
--   4. Motif obligatoire — RPC sans motif -> exception.
--   5. Régression préservée — payment_alias reste modifiable sous authenticated
--      (le trigger ne réveille pas sur cette colonne, grant UPDATE table intact).
--   6. Invariant téléphone — même un écrivain privilégié (postgres) ne peut pas
--      modifier le téléphone directement.

begin;

-- ---------------------------------------------------------------------------
-- 1. GRANTS + présence du trigger.
-- ---------------------------------------------------------------------------
do $$
begin
  if not has_function_privilege('authenticated',
       'public.update_landlord_identity(text,text,text,text)', 'execute') then
    raise exception 'FAIL grants: authenticated sans execute sur update_landlord_identity';
  end if;
  if has_function_privilege('anon',
       'public.update_landlord_identity(text,text,text,text)', 'execute') then
    raise exception 'FAIL grants: anon peut exécuter update_landlord_identity';
  end if;

  -- Le privilège TABLE UPDATE de authenticated reste (payment_alias + archive) :
  -- le verrou est porté par le trigger, pas par une révocation de privilège.
  if not has_table_privilege('authenticated', 'public.landlords', 'UPDATE') then
    raise exception 'FAIL grants: authenticated a perdu UPDATE sur landlords (régression grants)';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.landlords'::regclass
      and tgname = 'landlords_identity_lock'
      and not tgisinternal
  ) then
    raise exception 'FAIL: trigger landlords_identity_lock absent';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures jetables (créées en postgres, exploitées ensuite sous authenticated).
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('e1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'identity-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name, civility)
values ('e2222222-2222-2222-2222-222222222222',
        'e1111111-1111-1111-1111-111111111111',
        '+22990000020', 'Ancien', 'Nom', 'not_specified');

select set_config('request.jwt.claim.sub',
                  'e1111111-1111-1111-1111-111111111111', true);

-- ---------------------------------------------------------------------------
-- 2-5. Sous le rôle authenticated : direct rejeté, RPC OK, régressions.
-- ---------------------------------------------------------------------------
do $$
declare
  v_first text;
  v_msg text;
  v_reason_ok boolean;
  v_audit_count integer;
  v_audit_reason text;
begin
  set local role authenticated;

  -- 2a. UPDATE direct du nom -> landlord_identity_locked, valeur inchangée.
  v_msg := null;
  begin
    update public.landlords
    set first_name = 'Hacked'
    where id = 'e2222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: UPDATE direct de first_name accepté sous authenticated';
  exception
    when raise_exception then
      v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg not like '%landlord_identity_locked%' then
    raise exception 'FAIL: mauvais rejet du nom direct (=%)', v_msg;
  end if;

  select first_name into v_first from public.landlords
  where id = 'e2222222-2222-2222-2222-222222222222';
  if v_first <> 'Ancien' then
    raise exception 'FAIL: first_name modifié malgré le rejet (=%)', v_first;
  end if;

  -- 2b. UPDATE direct du téléphone -> landlord_phone_change_forbidden.
  v_msg := null;
  begin
    update public.landlords
    set phone = '+22990009999'
    where id = 'e2222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: UPDATE direct de phone accepté sous authenticated';
  exception
    when raise_exception then
      v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg not like '%landlord_phone_change_forbidden%' then
    raise exception 'FAIL: mauvais rejet du téléphone direct (=%)', v_msg;
  end if;

  -- 3. RPC audité -> change le nom ET écrit l'audit dans la même transaction.
  perform public.update_landlord_identity(
    'Nouvelle', 'Identité', 'mrs', 'correction état civil');

  select first_name into v_first from public.landlords
  where id = 'e2222222-2222-2222-2222-222222222222';
  if v_first <> 'Nouvelle' then
    raise exception 'FAIL: RPC n''a pas changé le nom (=%)', v_first;
  end if;

  select count(*), max(metadata ->> 'reason')
    into v_audit_count, v_audit_reason
  from public.audit_logs
  where entity_type = 'landlords'
    and entity_id = 'e2222222-2222-2222-2222-222222222222'
    and action = 'update_landlord_identity';
  if v_audit_count < 1 then
    raise exception 'FAIL: aucun audit update_landlord_identity écrit';
  end if;
  if v_audit_reason is distinct from 'correction état civil' then
    raise exception 'FAIL: motif d''audit absent/incorrect (=%)', v_audit_reason;
  end if;

  -- 4. RPC sans motif -> rejeté.
  v_reason_ok := true;
  begin
    perform public.update_landlord_identity('Autre', 'Nom', 'mr', '   ');
    v_reason_ok := false;
  exception
    when raise_exception then
      null; -- attendu (identity_change_reason_required)
  end;
  if not v_reason_ok then
    raise exception 'FAIL: RPC a accepté un motif vide';
  end if;

  -- 5. Régression : mise à jour de l'alias de paiement (colonne mutable
  --    non-identité) OK sous authenticated — le trigger ne se réveille pas
  --    sur cette colonne, le grant UPDATE table reste intact.
  update public.landlords
  set payment_alias = '+22990001234', payment_alias_type = 'phone'
  where id = 'e2222222-2222-2222-2222-222222222222';

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Invariant téléphone — même en postgres (écrivain privilégié), un UPDATE
--    direct du téléphone lève : le numéro de connexion n'est jamais un simple
--    champ (ADR-002), aucun rôle ne le contourne.
-- ---------------------------------------------------------------------------
do $$
declare
  v_phone_locked boolean := false;
begin
  begin
    update public.landlords
    set phone = '+22990008888'
    where id = 'e2222222-2222-2222-2222-222222222222';
  exception
    when raise_exception then
      if sqlerrm like '%landlord_phone_change_forbidden%' then v_phone_locked := true; end if;
  end;
  if not v_phone_locked then
    raise exception 'FAIL: UPDATE direct du téléphone en postgres non bloqué par le trigger';
  end if;
end $$;

rollback;

select 'landlord_identity_lock.test.sql: OK' as result;
