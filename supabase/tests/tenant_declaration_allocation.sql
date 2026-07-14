-- Test SQL transactionnel — déclaration locataire crée une allocation réelle.
-- Vérifie migration 20260703010000_tenant_declaration_allocates_due.
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution locale (jamais contre la prod) :
--   supabase db start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/tenant_declaration_allocation.sql

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('d1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'declare-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('d2222222-2222-2222-2222-222222222222',
        'd1111111-1111-1111-1111-111111111111',
        '+22990000099', 'Test', 'Declare');

select set_config('request.jwt.claim.sub',
                  'd1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('d3333333-3333-3333-3333-333333333333',
        'd2222222-2222-2222-2222-222222222222', 'Cour Déclaration');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('da000000-0000-0000-0000-000000000001','d2222222-2222-2222-2222-222222222222','d3333333-3333-3333-3333-333333333333','U1','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('db000000-0000-0000-0000-000000000001','d2222222-2222-2222-2222-222222222222','Loc','Declare','+22991000099');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, end_date, status)
values ('dc000000-0000-0000-0000-000000000001','d2222222-2222-2222-2222-222222222222','da000000-0000-0000-0000-000000000001','db000000-0000-0000-0000-000000000001',50000,5,date '2023-01-05',date '2023-03-03','active');

select public.generate_rent_dues('dc000000-0000-0000-0000-000000000001');

-- Deux échéances : janvier et février (mars = fin de bail le 3, dû aussi).
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001';
  if v_count < 2 then
    raise exception 'fixture: attendu >= 2 échéances, obtenu %', v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 1 : token invalide -> not_found
-- ---------------------------------------------------------------------------
do $$
begin
  if public.declare_rent_payment_by_token('00000000-0000-0000-0000-000000000000') <> 'not_found' then
    raise exception 'cas 1: token invalide doit renvoyer not_found';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 2 : première déclaration -> réception draft + allocation exacte
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  v_result text;
  v_reception public.rent_receptions;
  v_alloc public.rent_reception_allocations;
begin
  select * into v_due from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001'
  order by due_date limit 1;

  v_result := public.declare_rent_payment_by_token(v_due.confirmation_token);
  if v_result <> 'ok' then
    raise exception 'cas 2: attendu ok, obtenu %', v_result;
  end if;

  select rr.* into v_reception
  from public.rent_receptions rr
  join public.rent_reception_allocations a on a.rent_reception_id = rr.id
  where a.rent_due_id = v_due.id;
  if not found then
    raise exception 'cas 2: aucune réception liée par allocation à l''échéance';
  end if;
  if v_reception.status <> 'draft' then
    raise exception 'cas 2: réception attendue en draft, obtenu %', v_reception.status;
  end if;

  select * into v_alloc from public.rent_reception_allocations
  where rent_due_id = v_due.id;
  if v_alloc.amount_allocated <> v_due.amount_due then
    raise exception 'cas 2: allocation % <> reste dû %', v_alloc.amount_allocated, v_due.amount_due;
  end if;
  if v_reception.amount_received <> v_due.amount_due then
    raise exception 'cas 2: montant reçu % <> reste dû %', v_reception.amount_received, v_due.amount_due;
  end if;

  -- Statut lecture : already_declared visible via get_rent_due_by_token
  if (select declaration_status from public.get_rent_due_by_token(v_due.confirmation_token)) <> 'draft' then
    raise exception 'cas 2: declaration_status attendu draft';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 3 : seconde déclaration sur la même échéance -> already_declared
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
begin
  select * into v_due from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001'
  order by due_date limit 1;

  if public.declare_rent_payment_by_token(v_due.confirmation_token) <> 'already_declared' then
    raise exception 'cas 3: attendu already_declared';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 4 : la déclaration ne touche AUCUNE autre échéance (même bail, même
-- locataire, même logement : l'échéance de février reste déclarable)
-- ---------------------------------------------------------------------------
do $$
declare
  v_due2 public.rent_dues;
begin
  select * into v_due2 from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001'
  order by due_date offset 1 limit 1;

  if exists (select 1 from public.rent_reception_allocations where rent_due_id = v_due2.id) then
    raise exception 'cas 4: l''échéance 2 ne doit avoir aucune allocation';
  end if;
  -- Une réception draft de la même période/unit/tenant ne bloque pas :
  if (select declaration_status from public.get_rent_due_by_token(v_due2.confirmation_token)) is not null then
    raise exception 'cas 4: declaration_status de l''échéance 2 doit être null';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 5 : confirmation propriétaire -> échéance paid, document avec allocations
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  v_reception_id uuid;
  v_receipt_id uuid;
  v_allocs jsonb;
begin
  select * into v_due from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001'
  order by due_date limit 1;

  select a.rent_reception_id into v_reception_id
  from public.rent_reception_allocations a
  where a.rent_due_id = v_due.id;

  perform public.confirm_collection(v_reception_id);

  select * into v_due from public.rent_dues where id = v_due.id;
  if v_due.status <> 'paid' then
    raise exception 'cas 5: échéance attendue paid, obtenu %', v_due.status;
  end if;

  v_receipt_id := public.generate_receipt(v_reception_id);
  select snapshot->'allocations' into v_allocs from public.receipts where id = v_receipt_id;
  if v_allocs is null or jsonb_array_length(v_allocs) = 0 then
    raise exception 'cas 5: le document doit contenir des allocations non vides';
  end if;

  -- Lecture token : already_confirmed
  if (select declaration_status from public.get_rent_due_by_token(v_due.confirmation_token)) <> 'confirmed' then
    raise exception 'cas 5: declaration_status attendu confirmed';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 6 : échéance payée -> already_processed / already_confirmed
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  v_result text;
begin
  select * into v_due from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001'
  order by due_date limit 1;

  v_result := public.declare_rent_payment_by_token(v_due.confirmation_token);
  if v_result not in ('already_processed', 'already_confirmed') then
    raise exception 'cas 6: attendu already_processed/already_confirmed, obtenu %', v_result;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cas 7 : paiement partiel confirmé -> la déclaration alloue le reste dû
-- ---------------------------------------------------------------------------
do $$
declare
  v_due2 public.rent_dues;
  v_reception_id uuid;
  v_result text;
  v_alloc integer;
  v_remaining integer;
begin
  select * into v_due2 from public.rent_dues
  where lease_id = 'dc000000-0000-0000-0000-000000000001'
  order by due_date offset 1 limit 1;

  -- Le propriétaire encaisse 20 000 sur 50 000 (partiel, confirmé).
  v_reception_id := public.record_collection(
    'db000000-0000-0000-0000-000000000001',
    'da000000-0000-0000-0000-000000000001',
    20000, 'cash', now(), null,
    jsonb_build_array(jsonb_build_object('rent_due_id', v_due2.id, 'amount_allocated', 20000)),
    null::text -- p_reference : lève l'ambiguïté entre les deux surcharges
  );
  perform public.confirm_collection(v_reception_id);

  select amount_remaining into v_remaining
  from public.get_rent_due_by_token(v_due2.confirmation_token);
  if v_remaining <> 30000 then
    raise exception 'cas 7: amount_remaining attendu 30000, obtenu %', v_remaining;
  end if;

  v_result := public.declare_rent_payment_by_token(v_due2.confirmation_token);
  if v_result <> 'ok' then
    raise exception 'cas 7: attendu ok, obtenu %', v_result;
  end if;

  select a.amount_allocated into v_alloc
  from public.rent_reception_allocations a
  join public.rent_receptions rr on rr.id = a.rent_reception_id
  where a.rent_due_id = v_due2.id and rr.status = 'draft';
  if v_alloc <> 30000 then
    raise exception 'cas 7: allocation draft attendue 30000, obtenu %', v_alloc;
  end if;
end $$;

select 'tenant_declaration_allocation: OK' as result;

rollback;
