-- Test SQL transactionnel — ADR-004 (génération échéances + invariants).
-- Source de vérité = Postgres. Ce script crée des données JETABLES, appelle
-- la vraie fonction public.generate_rent_dues, vérifie les cas critiques, et
-- ROLLBACK à la fin : rien n'est persistant.
--
-- Exécution locale (jamais contre la prod) :
--   supabase db start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/rent_due_generation.sql
--
-- Tous les baux de test finissent en 2023 (passé) -> horizon de génération
-- borné par end_date -> résultats déterministes quelle que soit la date.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rentdue-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        '+22990000000', 'Test', 'Landlord');

-- Fait pointer auth.uid() -> ce landlord (current_landlord_id l'exige).
select set_config('request.jwt.claim.sub',
                  '11111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222', 'Cour Test');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','U1','room'),
       ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','U2','room'),
       ('a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','U3','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Loc','Un','+22991000001');

-- L1 : début 29 (> due_day 5) -> saute juin, démarre juillet ; cap fin août.
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, end_date, status)
values ('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',50000,5,date '2023-06-29',date '2023-08-31','active');

-- L2 : due_day 31 -> clamp dernier jour ; janvier(31) + février(28).
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, end_date, status)
values ('c0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001',50000,31,date '2023-01-31',date '2023-02-28','active');

-- L3 : fin le 3 mars, due_day 5 -> dernier mois dû, due_date 2023-03-05 (> end_date).
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, end_date, status)
values ('c0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001',50000,5,date '2023-01-05',date '2023-03-03','active');

-- ---------------------------------------------------------------------------
-- Génération
-- ---------------------------------------------------------------------------
select public.generate_rent_dues('c0000000-0000-0000-0000-000000000001');
select public.generate_rent_dues('c0000000-0000-0000-0000-000000000002');
select public.generate_rent_dues('c0000000-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------
do $$
declare n int; d date;
begin
  -- L1 : cas 2 (skip premier mois) + cas 4 (cap end_date) -> juillet+août.
  select count(*) into n from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000001';
  if n <> 2 then raise exception 'L1: attendu 2 echeances, obtenu %', n using errcode='90001'; end if;
  select min(period_start) into d from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000001';
  if d <> date '2023-07-01' then raise exception 'L1: premiere periode = % (attendu 2023-07-01)', d using errcode='90001'; end if;
  select max(period_start) into d from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000001';
  if d <> date '2023-08-01' then raise exception 'L1: derniere periode = % (attendu 2023-08-01)', d using errcode='90001'; end if;

  -- L2 : cas 3 (clamp) -> fevrier due_date = 2023-02-28.
  select due_date into d from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000002' and period_start=date '2023-02-01';
  if d <> date '2023-02-28' then raise exception 'L2: clamp fevrier = % (attendu 2023-02-28)', d using errcode='90001'; end if;

  -- L3 : due_date > end_date autorisee si meme mois.
  select due_date into d from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000003' and period_start=date '2023-03-01';
  if d is null then raise exception 'L3: periode mars absente' using errcode='90001'; end if;
  if d <> date '2023-03-05' then raise exception 'L3: due_date mars = % (attendu 2023-03-05)', d using errcode='90001'; end if;

  -- Invariants globaux sur toutes les echeances generees.
  if exists (select 1 from public.rent_dues rd join public.leases l on l.id=rd.lease_id
             where l.landlord_id='22222222-2222-2222-2222-222222222222'
               and rd.period_start < date_trunc('month', l.start_date)::date) then
    raise exception 'INVARIANT: echeance avant debut bail' using errcode='90001';
  end if;
  if exists (select 1 from public.rent_dues
             where landlord_id='22222222-2222-2222-2222-222222222222'
               and (due_date < period_start or due_date > period_end)) then
    raise exception 'INVARIANT: due_date hors du mois couvert' using errcode='90001';
  end if;

  -- Idempotence (cas 5) : re-generation ne cree pas de doublon.
  perform public.generate_rent_dues('c0000000-0000-0000-0000-000000000003');
  select count(*) into n from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000003';
  if n <> 3 then raise exception 'L3: re-gen a duplique (% lignes)', n using errcode='90001'; end if;

  raise notice 'OK generation : tous les cas passent';
end $$;

-- ---------------------------------------------------------------------------
-- Trigger : echeance avant debut bail rejetee
-- ---------------------------------------------------------------------------
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.rent_dues (landlord_id, lease_id, unit_id, tenant_id, period_start, period_end, due_date, amount_due, currency, status)
    values ('22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001',
            date '2022-12-01', date '2022-12-31', date '2022-12-05', 50000, 'XOF', 'expected');
  exception when sqlstate 'P0001' then blocked := true;
  end;
  if not blocked then raise exception 'TRIGGER FAIL: insert avant debut bail aurait du etre rejete' using errcode='90001'; end if;
  raise notice 'OK trigger debut-bail';
end $$;

-- ---------------------------------------------------------------------------
-- Trigger protection financiere : echeance allouee non reecrite / non supprimee
-- ---------------------------------------------------------------------------
insert into public.rent_receptions (id, landlord_id, tenant_id, unit_id, received_at, amount_received, payment_method, status, confirmed_at)
values ('d0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003', now(), 50000, 'cash', 'confirmed', now());

insert into public.rent_reception_allocations (id, landlord_id, rent_reception_id, rent_due_id, amount_allocated)
select 'e0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','d0000000-0000-0000-0000-000000000001', id, 50000
from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000003' and period_start=date '2023-01-01';

do $$
declare blocked boolean; due_id uuid;
begin
  select id into due_id from public.rent_dues where lease_id='c0000000-0000-0000-0000-000000000003' and period_start=date '2023-01-01';

  -- update champ financier -> rejete
  blocked := false;
  begin
    update public.rent_dues set amount_due = 1 where id = due_id;
  exception when sqlstate 'P0001' then blocked := true;
  end;
  if not blocked then raise exception 'TRIGGER FAIL: update amount_due alloue non bloque' using errcode='90001'; end if;

  -- delete -> rejete
  blocked := false;
  begin
    delete from public.rent_dues where id = due_id;
  exception when sqlstate 'P0001' then blocked := true;
  end;
  if not blocked then raise exception 'TRIGGER FAIL: delete echeance allouee non bloque' using errcode='90001'; end if;

  -- update non destructif (updated_at) -> autorise
  update public.rent_dues set updated_at = now() where id = due_id;

  raise notice 'OK trigger protection financiere';
end $$;

rollback;
