-- Test SQL transactionnel — scellement de l'empreinte à l'émission
-- (migration 20260727120000). Données JETABLES, vraies RPC, ROLLBACK final.
-- Local seulement, jamais prod. Joué par `supabase/tests/run-all.sh` (et par
-- la CI, job `db`) ; en isolation :
--   supabase db start
--   docker exec -i supabase_db_<proj> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/receipt_sealed_at_issue.test.sql
--
-- Cas prouvés :
--   1. generate_receipt scelle sha256_fingerprint dès l'émission (non null)
--   2. le sceau vaut exactement la recette unique (receipt_computed_fingerprint)
--   3. verify_receipt_integrity rend un recalcul égal au sceau -> « verified »
--      SANS aucune action du locataire
--   4. verify_receipt_by_number rend « verified » sur le même document
--   5. certify_receipt_by_token NE RÉÉCRIT PAS le sceau d'émission
--   6. une altération du snapshot fait diverger le recalcul -> « tampered »
--      sur les DEUX chemins (QR et référence), preuve que la recette est
--      bien partagée
--   7. l'émission scelle AUSSI sous le rôle `authenticated` (grants EXECUTE
--      réels) — les cas 1-6 tournent en superuser et ne le prouvent pas

begin;

insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','seal@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','+22990000000','Test','Landlord');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name, city, address)
values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','Cour Test','Calavi','Lot 42');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','U1','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Loc','Un','+22991000001');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',50000,5,date '2023-01-05','active');

-- Échéance soldée -> le document émis sera une quittance.
insert into public.rent_dues (id, landlord_id, lease_id, unit_id, tenant_id, period_start, period_end, due_date, amount_due, currency, status)
values ('d0000000-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',date '2023-01-01',date '2023-01-31',date '2023-01-05',50000,'XOF','paid');

insert into public.rent_receptions (id, landlord_id, tenant_id, unit_id, received_at, amount_received, payment_method, status, confirmed_at)
values ('e0000000-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', now(), 50000, 'cash', 'confirmed', now());

insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
values ('22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-00000000000a',50000);

-- ── Émission ────────────────────────────────────────────────────────────────
create temporary table t_receipt on commit drop as
select public.generate_receipt('e0000000-0000-0000-0000-00000000000a'::uuid) as id;

-- 1. Scellé dès l'émission, sans aucune action du locataire.
do $$
declare v public.receipts%rowtype;
begin
  select r.* into v from public.receipts r join t_receipt t on t.id = r.id;
  if v.sha256_fingerprint is null then
    raise exception 'ECHEC 1 : sha256_fingerprint null a l''emission';
  end if;
  if v.tenant_ack <> 'unilateral' then
    raise exception 'ECHEC 1 : le locataire n''a rien fait, tenant_ack=%', v.tenant_ack;
  end if;

  -- 2. Le sceau vaut exactement la recette unique.
  if v.sha256_fingerprint <>
     private.receipt_computed_fingerprint(v.receipt_number, v.issued_at, v.snapshot) then
    raise exception 'ECHEC 2 : le sceau ne suit pas la recette partagee';
  end if;
  raise notice 'OK 1-2 : scelle a l''emission, recette unique respectee';
end $$;

-- 3. Chemin QR : verdict « verified » sans certification.
do $$
declare v record;
begin
  select * into v from public.verify_receipt_integrity((select id from t_receipt));
  if v.stored_fingerprint is distinct from v.computed_fingerprint then
    raise exception 'ECHEC 3 : stored=% computed=%', v.stored_fingerprint, v.computed_fingerprint;
  end if;
  raise notice 'OK 3 : /verifier/[id] rend un document intact sans action locataire';
end $$;

-- 4. Chemin référence : même verdict.
do $$
declare v record; v_num text;
begin
  select r.receipt_number into v_num from public.receipts r join t_receipt t on t.id = r.id;
  select * into v from public.verify_receipt_by_number(v_num);
  if v.integrity <> 'verified' then
    raise exception 'ECHEC 4 : integrity=% attendu verified', v.integrity;
  end if;
  raise notice 'OK 4 : /verifier par reference rend verified';
end $$;

-- 5. La certification n'écrase pas le sceau d'émission.
do $$
declare v_before text; v_after text; v_token uuid; v_res text;
begin
  select r.sha256_fingerprint, r.tenant_token into v_before, v_token
  from public.receipts r join t_receipt t on t.id = r.id;

  v_res := public.certify_receipt_by_token(v_token);
  if v_res <> 'ok' then
    raise exception 'ECHEC 5 : certify a renvoye %', v_res;
  end if;

  select r.sha256_fingerprint into v_after
  from public.receipts r join t_receipt t on t.id = r.id;

  if v_after is distinct from v_before then
    raise exception 'ECHEC 5 : sceau reecrit a la certification (% -> %)', v_before, v_after;
  end if;
  raise notice 'OK 5 : certification = deuxieme voix, le sceau d''emission tient';
end $$;

-- 6. Altération du snapshot -> « tampered » sur les DEUX chemins.
--    (Écriture directe en table : simule exactement ce que la vérification
--     est censée détecter. Impossible via les RPC produit.)
do $$
declare v record; v_num text;
begin
  update public.receipts
  set snapshot = jsonb_set(snapshot, '{tenant,last_name}', '"Falsifie"')
  where id = (select id from t_receipt);

  select * into v from public.verify_receipt_integrity((select id from t_receipt));
  if v.stored_fingerprint = v.computed_fingerprint then
    raise exception 'ECHEC 6 : alteration non detectee par le chemin QR';
  end if;

  select r.receipt_number into v_num from public.receipts r join t_receipt t on t.id = r.id;
  select * into v from public.verify_receipt_by_number(v_num);
  if v.integrity <> 'tampered' then
    raise exception 'ECHEC 6 : chemin reference rend % au lieu de tampered', v.integrity;
  end if;
  raise notice 'OK 6 : alteration detectee identiquement par les deux chemins';
end $$;

-- 7. Chemin PRODUIT : émission sous le rôle `authenticated`.
--    Les cas 1-6 tournent en superuser, qui CONTOURNE les privilèges EXECUTE.
--    private.generate_receipt_core est SECURITY INVOKER : un GRANT manquant sur
--    private.receipt_computed_fingerprint passerait vert ci-dessus et casserait
--    toute émission en production. Ce cas est le seul à le prouver.
insert into public.rent_dues (id, landlord_id, lease_id, unit_id, tenant_id, period_start, period_end, due_date, amount_due, currency, status)
values ('d0000000-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',date '2023-02-01',date '2023-02-28',date '2023-02-05',50000,'XOF','paid');

insert into public.rent_receptions (id, landlord_id, tenant_id, unit_id, received_at, amount_received, payment_method, status, confirmed_at)
values ('e0000000-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', now(), 50000, 'cash', 'confirmed', now());

insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
values ('22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-00000000000b','d0000000-0000-0000-0000-00000000000b',50000);

set local role authenticated;
select public.generate_receipt('e0000000-0000-0000-0000-00000000000b'::uuid) is not null as emission_sous_authenticated;
reset role;

do $$
declare v public.receipts%rowtype;
begin
  select * into v from public.receipts
  where rent_reception_id = 'e0000000-0000-0000-0000-00000000000b';

  if v.sha256_fingerprint is null then
    raise exception 'ECHEC 7 : aucun sceau sur le chemin authenticated';
  end if;
  if v.sha256_fingerprint <>
     private.receipt_computed_fingerprint(v.receipt_number, v.issued_at, v.snapshot) then
    raise exception 'ECHEC 7 : sceau incoherent sous authenticated';
  end if;
  raise notice 'OK 7 : emission sous authenticated scellee (grants EXECUTE reels)';
end $$;

rollback;
