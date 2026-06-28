-- Test SQL transactionnel — ADR-005 (flux de correction quittance/encaissement).
-- Données JETABLES, vraies RPC, ROLLBACK final. Local seulement, jamais prod.
--   supabase db start
--   docker exec -i supabase_db_<proj> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/receipt_correction_flows.sql
--
-- Cas prouvés :
--   1. annuler receipt seul -> encaissement intact
--   2. annuler collection avec receipt actif -> refusé
--   3. annuler receipt puis annuler collection -> ok explicite
--   4. remplacer receipt -> nouveau document actif
--   5. ancien reste 'cancelled'
--   6. nouveau pointe vers ancien via replaces_receipt_id
--   7. une seule quittance 'issued' active par rent_reception_id
--   8. generate_receipt après annulation ne renvoie pas l'ancien annulé

begin;

insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','adr005@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','+22990000000','Test','Landlord');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','Cour Test');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','U1','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Loc','Un','+22991000001');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',50000,5,date '2023-01-05','active');

-- 2 échéances (mois distincts), 2 réceptions confirmées, 2 allocations.
insert into public.rent_dues (id, landlord_id, lease_id, unit_id, tenant_id, period_start, period_end, due_date, amount_due, currency, status)
values ('d0000000-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',date '2023-01-01',date '2023-01-31',date '2023-01-05',50000,'XOF','expected'),
       ('d0000000-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',date '2023-02-01',date '2023-02-28',date '2023-02-05',50000,'XOF','expected');

insert into public.rent_receptions (id, landlord_id, tenant_id, unit_id, received_at, amount_received, payment_method, status, confirmed_at)
values ('e0000000-0000-0000-0000-00000000000A','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', now(), 50000, 'cash', 'confirmed', now()),
       ('e0000000-0000-0000-0000-00000000000B','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', now(), 50000, 'cash', 'confirmed', now());

insert into public.rent_reception_allocations (id, landlord_id, rent_reception_id, rent_due_id, amount_allocated)
values ('f0000000-0000-0000-0000-00000000000A','22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-00000000000A','d0000000-0000-0000-0000-00000000000a',50000),
       ('f0000000-0000-0000-0000-00000000000B','22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-00000000000B','d0000000-0000-0000-0000-00000000000b',50000);

do $$
declare
  recA uuid := 'e0000000-0000-0000-0000-00000000000A';
  recB uuid := 'e0000000-0000-0000-0000-00000000000B';
  r_a1 uuid; r_a2 uuid; r_a3 uuid; r_b1 uuid;
  st text; n int; blocked boolean; lnk uuid;
begin
  r_a1 := public.generate_receipt(recA);

  -- Cas 1 : annuler receipt seul -> encaissement intact.
  perform public.cancel_receipt(r_a1, 'erreur de doc');
  select status into st from public.rent_receptions where id = recA;
  if st <> 'confirmed' then raise exception 'CAS1: reception A = % (attendu confirmed)', st using errcode='90001'; end if;

  -- Cas 8 : re-générer ne renvoie pas l'ancien annulé -> nouveau doc actif.
  r_a2 := public.generate_receipt(recA);
  if r_a2 = r_a1 then raise exception 'CAS8: generate_receipt a renvoye le receipt annule' using errcode='90001'; end if;
  select status into st from public.receipts where id = r_a2;
  if st <> 'issued' then raise exception 'CAS8: nouveau receipt = % (attendu issued)', st using errcode='90001'; end if;

  -- Cas 2 : annuler collection avec receipt actif -> refusé.
  r_b1 := public.generate_receipt(recB);
  blocked := false;
  begin
    perform public.cancel_collection(recB, 'tentative');
  exception when sqlstate 'P0001' then blocked := true;
  end;
  if not blocked then raise exception 'CAS2: cancel_collection avec receipt actif non bloque' using errcode='90001'; end if;

  -- Cas 3 : annuler receipt puis annuler collection -> ok explicite.
  perform public.cancel_receipt(r_b1, 'paiement saisi par erreur');
  perform public.cancel_collection(recB, 'retrait encaissement');
  select status into st from public.rent_receptions where id = recB;
  if st <> 'cancelled' then raise exception 'CAS3: reception B = % (attendu cancelled)', st using errcode='90001'; end if;

  -- Cas 4/5/6 : remplacer le receipt actif de A (r_a2).
  r_a3 := public.replace_receipt(r_a2, 'quittance corrigee');
  if r_a3 = r_a2 then raise exception 'CAS4: replace_receipt n a pas cree de nouveau doc' using errcode='90001'; end if;
  select status into st from public.receipts where id = r_a3;
  if st <> 'issued' then raise exception 'CAS4: nouveau receipt = % (attendu issued)', st using errcode='90001'; end if;
  select status into st from public.receipts where id = r_a2;
  if st <> 'cancelled' then raise exception 'CAS5: ancien receipt = % (attendu cancelled)', st using errcode='90001'; end if;
  select replaces_receipt_id into lnk from public.receipts where id = r_a3;
  if lnk is distinct from r_a2 then raise exception 'CAS6: replaces_receipt_id = % (attendu %)', lnk, r_a2 using errcode='90001'; end if;

  -- replace refuse sur un receipt non-issued.
  blocked := false;
  begin
    perform public.replace_receipt(r_a2, 'deja annule');
  exception when sqlstate 'P0001' then blocked := true;
  end;
  if not blocked then raise exception 'replace_receipt sur annule non bloque' using errcode='90001'; end if;

  -- Cas 7 : une seule quittance 'issued' active par reception.
  select count(*) into n from public.receipts where rent_reception_id = recA and status='issued' and deleted_at is null;
  if n <> 1 then raise exception 'CAS7: % receipts issued actifs pour A (attendu 1)', n using errcode='90001'; end if;
  blocked := false;
  begin
    insert into public.receipts (landlord_id, rent_reception_id, receipt_number, total_amount, currency, status, kind, snapshot)
    values ('22222222-2222-2222-2222-222222222222', recA, 'R-DUP', 50000, 'XOF', 'issued', 'receipt', '{}'::jsonb);
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'CAS7: 2e receipt issued actif accepte (index unique manquant)' using errcode='90001'; end if;

  raise notice 'OK ADR-005 : 8 cas passent';
end $$;

rollback;
