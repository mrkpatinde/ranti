-- Test SQL transactionnel — idempotence des écritures critiques (#167 Phase 1).
-- Source de vérité = Postgres. Crée des données JETABLES, appelle les vraies
-- fonctions record_collection / bulk_onboard_portfolio avec p_request_id,
-- vérifie qu'un rejeu ne double JAMAIS une écriture, puis ROLLBACK.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/idempotent_writes.test.sql

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('b1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'idem-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('b2222222-2222-2222-2222-222222222222',
        'b1111111-1111-1111-1111-111111111111',
        '+22990000002', 'Idem', 'Test');

select set_config('request.jwt.claim.sub',
                  'b1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('b3333333-3333-3333-3333-333333333333',
        'b2222222-2222-2222-2222-222222222222', 'Cour Idem');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('b4444444-4444-4444-4444-444444444444',
        'b2222222-2222-2222-2222-222222222222',
        'b3333333-3333-3333-3333-333333333333', 'Chambre A', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('b5555555-5555-5555-5555-555555555555',
        'b2222222-2222-2222-2222-222222222222', 'Awa', 'Idem', '+2290100000009');

-- ---------------------------------------------------------------------------
-- 1. record_collection : le même p_request_id rejoué renvoie LA MÊME réception
--    (fast-log sans allocation : le chemin le plus court suffit à l'invariant).
-- ---------------------------------------------------------------------------
do $$
declare
  k1 uuid := 'c1111111-1111-1111-1111-111111111111';
  rid1 uuid;
  rid2 uuid;
  n int;
begin
  rid1 := public.record_collection(
    'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    50000, 'cash', null, 'test idem', '[]'::jsonb, null, k1
  );

  rid2 := public.record_collection(
    'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    50000, 'cash', null, 'test idem (rejeu)', '[]'::jsonb, null, k1
  );

  if rid1 is distinct from rid2 then
    raise exception 'rejeu: reception différente (%, %)', rid1, rid2 using errcode='90001';
  end if;

  select count(*) into n from public.rent_receptions
  where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if n <> 1 then
    raise exception 'rejeu: % réceptions (attendu 1)', n using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Un échec ne « brûle » pas la clé : la revendication est rollbackée avec
--    la transaction fautive ; la correction re-soumise avec la MÊME clé passe.
-- ---------------------------------------------------------------------------
do $$
declare
  k2 uuid := 'c2222222-2222-2222-2222-222222222222';
  rid uuid;
  n int;
begin
  begin
    perform public.record_collection(
      'b5555555-5555-5555-5555-555555555555',
      'b4444444-4444-4444-4444-444444444444',
      0, 'cash', null, 'montant invalide', '[]'::jsonb, null, k2
    );
    raise exception 'l''appel invalide aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%amount_invalid%' then raise; end if;
  end;

  rid := public.record_collection(
    'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    60000, 'cash', null, 'correction re-soumise', '[]'::jsonb, null, k2
  );
  if rid is null then
    raise exception 'clé brûlée par l''échec précédent' using errcode='90001';
  end if;

  select count(*) into n from public.rent_receptions
  where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if n <> 2 then
    raise exception 'après correction: % réceptions (attendu 2)', n using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Sans clé (p_request_id null) : comportement historique inchangé —
--    deux appels = deux réceptions.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  perform public.record_collection(
    'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    10000, 'cash', null, 'sans clé 1', '[]'::jsonb
  );
  perform public.record_collection(
    'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    10000, 'cash', null, 'sans clé 2', '[]'::jsonb
  );

  select count(*) into n from public.rent_receptions
  where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if n <> 4 then
    raise exception 'sans clé: % réceptions (attendu 4)', n using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. bulk_onboard_portfolio : le même p_request_id rejoué renvoie LE MÊME
--    récap, sans recréer logements / locataires / baux / échéances.
-- ---------------------------------------------------------------------------
do $$
declare
  k3 uuid := 'c3333333-3333-3333-3333-333333333333';
  r1 jsonb;
  r2 jsonb;
  u1 int; u2 int; l1 int; l2 int; d1 int; d2 int;
begin
  r1 := public.bulk_onboard_portfolio(
    '{"id":"b3333333-3333-3333-3333-333333333333"}'::jsonb,
    '[
       {"unit_name":"IU1","unit_type":"room","first_name":"Koffi","last_name":"Deux","phone":"+2290100000010","monthly_rent_amount":"40000","due_day":"5","start_date":"2023-01-05","end_date":"2023-02-28"},
       {"unit_name":"IU2","unit_type":"shop"}
     ]'::jsonb,
    k3
  );

  select count(*) into u1 from public.units where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  select count(*) into l1 from public.leases where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  select count(*) into d1 from public.rent_dues where landlord_id = 'b2222222-2222-2222-2222-222222222222';

  r2 := public.bulk_onboard_portfolio(
    '{"id":"b3333333-3333-3333-3333-333333333333"}'::jsonb,
    '[
       {"unit_name":"IU1","unit_type":"room","first_name":"Koffi","last_name":"Deux","phone":"+2290100000010","monthly_rent_amount":"40000","due_day":"5","start_date":"2023-01-05","end_date":"2023-02-28"},
       {"unit_name":"IU2","unit_type":"shop"}
     ]'::jsonb,
    k3
  );

  select count(*) into u2 from public.units where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  select count(*) into l2 from public.leases where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  select count(*) into d2 from public.rent_dues where landlord_id = 'b2222222-2222-2222-2222-222222222222';

  if r1 is distinct from r2 then
    raise exception 'bulk rejeu: récaps différents (% vs %)', r1, r2 using errcode='90001';
  end if;
  if u1 <> u2 or l1 <> l2 or d1 <> d2 then
    raise exception 'bulk rejeu: écritures dupliquées (units %->%, leases %->%, dues %->%)',
      u1, u2, l1, l2, d1, d2 using errcode='90001';
  end if;
  if (r1->>'units')::int <> 2 or (r1->>'leases')::int <> 1 then
    raise exception 'bulk: récap inattendu %', r1 using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Les scopes sont étanches : la même clé UUID peut servir dans un autre
--    scope sans collision.
-- ---------------------------------------------------------------------------
do $$
declare
  k1 uuid := 'c1111111-1111-1111-1111-111111111111'; -- déjà utilisée au test 1
  r jsonb;
begin
  r := public.bulk_onboard_portfolio(
    '{"id":"b3333333-3333-3333-3333-333333333333"}'::jsonb,
    '[{"unit_name":"IU3","unit_type":"room"}]'::jsonb,
    k1
  );
  if (r->>'units')::int <> 1 then
    raise exception 'scopes non étanches: %', r using errcode='90001';
  end if;
end $$;

select 'idempotent_writes: OK' as result;

rollback;
