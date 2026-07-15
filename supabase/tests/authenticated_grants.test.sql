-- Test SQL — grants explicites authenticated (migration 20260714170000).
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authenticated_grants.test.sql
--
-- ⚠️ Garde-fou de la leçon 2026-07-05 : les tests tournent en postgres et ne
--    "voient" pas un GRANT manquant — on interroge donc explicitement
--    has_table_privilege / has_function_privilege, PUIS on rejoue le flux
--    propriétaire complet sous `set local role authenticated` (lecture
--    portefeuille, édition, record → confirm → generate_receipt). C'est ce
--    smoke test qui aurait détecté la divergence prod/local du 2026-07-14
--    (tables ET cœurs private SECURITY INVOKER sans EXECUTE).
--
-- Volontairement AUCUNE assertion d'absence de privilège table ici : en prod
-- les défauts legacy donnent le DML complet — une assertion négative y
-- échouerait sans signaler un vrai problème.

begin;

-- ---------------------------------------------------------------------------
-- 1. GRANTS TABLES — la matrice requise par le code authenticated actuel
-- ---------------------------------------------------------------------------
do $$
declare
  v_priv record;
begin
  for v_priv in
    select * from (values
      ('public.landlords',                  'SELECT'),
      ('public.landlords',                  'INSERT'),
      ('public.landlords',                  'UPDATE'),
      ('public.properties',                 'SELECT'),
      ('public.properties',                 'INSERT'),
      ('public.properties',                 'UPDATE'),
      ('public.units',                      'SELECT'),
      ('public.units',                      'INSERT'),
      ('public.units',                      'UPDATE'),
      ('public.tenants',                    'SELECT'),
      ('public.tenants',                    'INSERT'),
      ('public.tenants',                    'UPDATE'),
      ('public.leases',                     'SELECT'),
      ('public.leases',                     'INSERT'),
      ('public.leases',                     'UPDATE'),
      ('public.rent_dues',                  'SELECT'),
      ('public.rent_dues',                  'INSERT'),
      ('public.rent_dues',                  'UPDATE'),
      ('public.rent_receptions',            'SELECT'),
      ('public.rent_receptions',            'INSERT'),
      ('public.rent_receptions',            'UPDATE'),
      ('public.rent_reception_allocations', 'SELECT'),
      ('public.rent_reception_allocations', 'INSERT'),
      ('public.receipts',                   'SELECT'),
      ('public.receipts',                   'INSERT'),
      ('public.receipts',                   'UPDATE'),
      ('public.reminders',                  'SELECT'),
      -- déjà couverts par leurs propres migrations, re-vérifiés ici
      ('public.reminder_events',            'SELECT'),
      ('public.journal_feed',               'SELECT'),
      ('public.rent_due_balances',          'SELECT')
    ) as t(tbl, priv)
  loop
    if not has_table_privilege('authenticated', v_priv.tbl, v_priv.priv) then
      raise exception 'FAIL grants: authenticated sans % sur %', v_priv.priv, v_priv.tbl;
    end if;
  end loop;

  -- payment_transactions : SELECT par COLONNE depuis v4 (All-Inclusive 5 %) —
  -- la vision reçu est lisible, la vision comptabilité (marge Ranti) jamais.
  -- Les assertions détaillées vivent dans payment_transactions.test.sql bloc 8.
  if not has_column_privilege('authenticated', 'public.payment_transactions', 'net_amount', 'SELECT') then
    raise exception 'FAIL grants: authenticated sans SELECT colonne sur payment_transactions';
  end if;
  if has_column_privilege('authenticated', 'public.payment_transactions', 'net_margin', 'SELECT') then
    raise exception 'FAIL grants: net_margin (marge Ranti) visible du propriétaire';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. GRANTS FONCTIONS — les cœurs private SECURITY INVOKER appelés par les
--    wrappers publics doivent être exécutables par authenticated.
-- ---------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select * from (values
      ('private.current_landlord_id()'),
      ('private.recompute_rent_due_status(uuid)'),
      ('private.confirm_collection_core(uuid,uuid)'),
      ('private.generate_receipt_core(uuid,uuid)'),
      ('private.record_collection_core(uuid,uuid,uuid,integer,text,timestamptz,text,jsonb,text,text,text)')
    ) as t(sig)
  loop
    if not has_function_privilege('authenticated', v_fn.sig, 'execute') then
      raise exception 'FAIL grants: authenticated sans execute sur %', v_fn.sig;
    end if;
  end loop;

  -- compute_transaction_details expose la décomposition coûts/marge (vision
  -- compta) : le revoke de 20260714230000 doit tenir pour authenticated ET anon.
  if has_function_privilege('authenticated',
       'private.compute_transaction_details(integer,integer,integer,integer)', 'execute')
     or has_function_privilege('anon',
       'private.compute_transaction_details(integer,integer,integer,integer)', 'execute') then
    raise exception 'FAIL grants: compute_transaction_details exécutable par authenticated/anon';
  end if;

  -- La surcharge 10 args doit avoir disparu (20260714120000) : sa présence
  -- rendait ambigus tous les appels à 10 arguments (wrapper legacy, ops).
  if exists (
    select 1 from pg_proc
    where oid = to_regprocedure(
      'private.record_collection_core(uuid,uuid,uuid,integer,text,timestamptz,text,jsonb,text,text)')
  ) then
    raise exception 'FAIL: surcharge 10 args de record_collection_core encore présente';
  end if;

  -- Même garde pour le wrapper public (20260714210000) : la surcharge 7 args
  -- rendait ambigu l'appel du formulaire d'encaissement (42725 vérifié en prod).
  if to_regprocedure(
    'public.record_collection(uuid,uuid,integer,text,timestamptz,text,jsonb)'
  ) is not null then
    raise exception 'FAIL: surcharge 7 args de record_collection encore présente';
  end if;

  -- Invariant sécurité : les cœurs private accordés à authenticated prennent
  -- p_landlord_id SANS garde d'appartenance — sûrs uniquement parce que
  -- SECURITY INVOKER laisse la RLS s'appliquer. Un flip en DEFINER avec ces
  -- grants = primitive d'écriture cross-tenant.
  if exists (
    select 1 from pg_proc p
    where p.pronamespace = 'private'::regnamespace
      and p.proname in ('record_collection_core', 'confirm_collection_core', 'generate_receipt_core')
      and p.prosecdef
  ) then
    raise exception 'FAIL: un cœur private accordé à authenticated est passé SECURITY DEFINER';
  end if;

  -- 20260714200000 : public.current_landlord_id() (code mort depuis 005,
  -- SECURITY DEFINER orpheline) doit avoir disparu — et la version private,
  -- utilisée par les 31 policies RLS, doit rester intacte.
  if to_regprocedure('public.current_landlord_id()') is not null then
    raise exception 'FAIL: public.current_landlord_id() existe encore (drop 20260714200000 non appliqué)';
  end if;
  if to_regprocedure('private.current_landlord_id()') is null then
    raise exception 'FAIL: private.current_landlord_id() manquante (les policies RLS en dépendent)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures jetables (créées en postgres, lues ensuite sous authenticated)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('d1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'grants-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('d2222222-2222-2222-2222-222222222222',
        'd1111111-1111-1111-1111-111111111111',
        '+22990000010', 'Grants', 'Test');

select set_config('request.jwt.claim.sub',
                  'd1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('d3333333-3333-3333-3333-333333333333',
        'd2222222-2222-2222-2222-222222222222', 'Cour Grants');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('d4444444-4444-4444-4444-444444444444',
        'd2222222-2222-2222-2222-222222222222',
        'd3333333-3333-3333-3333-333333333333', 'Ch. 1', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('d5555555-5555-5555-5555-555555555555',
        'd2222222-2222-2222-2222-222222222222', 'Sena', 'Locataire', '+22991000010');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('d6666666-6666-6666-6666-666666666666',
        'd2222222-2222-2222-2222-222222222222',
        'd4444444-4444-4444-4444-444444444444',
        'd5555555-5555-5555-5555-555555555555',
        50000, 'XOF', 5, '2026-06-01', 'active');

insert into public.rent_dues (id, landlord_id, lease_id, tenant_id, unit_id,
                              period_start, period_end, due_date, amount_due,
                              currency, status, confirmation_token)
values ('d7777777-7777-7777-7777-777777777777',
        'd2222222-2222-2222-2222-222222222222',
        'd6666666-6666-6666-6666-666666666666',
        'd5555555-5555-5555-5555-555555555555',
        'd4444444-4444-4444-4444-444444444444',
        '2026-07-01', '2026-07-31', '2026-07-05', 50000, 'XOF', 'expected',
        gen_random_uuid());

-- ---------------------------------------------------------------------------
-- 3. Smoke test — rejouer le flux propriétaire SOUS LE RÔLE authenticated.
--    Un `permission denied` (table OU fonction) ici = régression des grants :
--    c'est exactement la panne locale du 2026-07-14.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_reception uuid;
  v_receipt uuid;
  v_status text;
begin
  set local role authenticated;

  -- Lectures du portefeuille (queries.ts de chaque domaine + vues).
  select count(*) into v_count from public.landlords;
  if v_count <> 1 then raise exception 'FAIL RLS landlords: % lignes', v_count; end if;
  select count(*) into v_count from public.properties;
  select count(*) into v_count from public.units;
  select count(*) into v_count from public.tenants;
  select count(*) into v_count from public.leases;
  select count(*) into v_count from public.rent_dues;
  select count(*) into v_count from public.rent_receptions;
  select count(*) into v_count from public.rent_reception_allocations;
  select count(*) into v_count from public.receipts;
  select count(*) into v_count from public.reminders;
  select count(*) into v_count from public.reminder_events;
  select count(id) into v_count from public.payment_transactions; -- count(id) : SELECT par colonne (v4)
  select count(*) into v_count from public.journal_feed;
  select count(*) into v_count from public.rent_due_balances;

  -- Écritures directes (actions.ts) : édition d'un logement, nouveau locataire.
  update public.units set name = 'Ch. 1 bis'
  where id = 'd4444444-4444-4444-4444-444444444444';

  insert into public.tenants (landlord_id, first_name, last_name, phone)
  values ('d2222222-2222-2222-2222-222222222222', 'Ayo', 'Nouveau', '+22991000011');

  -- Chaîne RPC SECURITY INVOKER : record → confirm → generate_receipt
  -- (traverse INSERT rent_receptions + rent_reception_allocations,
  --  UPDATE rent_receptions + rent_dues, INSERT receipts).
  v_reception := public.record_collection(
    'd5555555-5555-5555-5555-555555555555'::uuid,
    'd4444444-4444-4444-4444-444444444444'::uuid,
    50000, 'cash', now(), 'test grants',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', 'd7777777-7777-7777-7777-777777777777',
      'amount_allocated', 50000)),
    null::text -- p_reference : lève l'ambiguïté entre les deux surcharges
  );
  if v_reception is null then raise exception 'FAIL record_collection: pas de réception'; end if;

  perform public.confirm_collection(v_reception);

  select status into v_status from public.rent_dues
  where id = 'd7777777-7777-7777-7777-777777777777';
  if v_status <> 'paid' then raise exception 'FAIL confirm: échéance %', v_status; end if;

  v_receipt := public.generate_receipt(v_reception);
  if v_receipt is null then raise exception 'FAIL generate_receipt: pas de reçu'; end if;

  reset role;
end $$;

rollback;

select 'authenticated_grants.test.sql: OK' as result;
