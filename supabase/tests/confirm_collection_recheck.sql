-- Test SQL transactionnel — re-contrôle financier à confirm_collection.
-- Vérifie migration 20260703020000_confirm_collection_recheck.
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution locale (jamais contre la prod) :
--   supabase db start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/confirm_collection_recheck.sql

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('e1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'recheck-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('e2222222-2222-2222-2222-222222222222',
        'e1111111-1111-1111-1111-111111111111',
        '+22990000098', 'Test', 'Recheck');

select set_config('request.jwt.claim.sub',
                  'e1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('e3333333-3333-3333-3333-333333333333',
        'e2222222-2222-2222-2222-222222222222', 'Cour Recheck');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('ea000000-0000-0000-0000-000000000001','e2222222-2222-2222-2222-222222222222','e3333333-3333-3333-3333-333333333333','U1','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('eb000000-0000-0000-0000-000000000001','e2222222-2222-2222-2222-222222222222','Loc','Recheck','+22991000098');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, end_date, status)
values ('ec000000-0000-0000-0000-000000000001','e2222222-2222-2222-2222-222222222222','ea000000-0000-0000-0000-000000000001','eb000000-0000-0000-0000-000000000001',50000,5,date '2023-01-05',date '2023-01-31','active');

select public.generate_rent_dues('ec000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Deux brouillons concurrents sur la même échéance, chacun couvrant le
-- reste dû complet (autorisé par record_collection : seuls les montants
-- CONFIRMÉS comptent à la création).
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  v_r1 uuid;
  v_r2 uuid;
  v_paid integer;
  v_second_refused boolean := false;
begin
  select * into v_due from public.rent_dues
  where lease_id = 'ec000000-0000-0000-0000-000000000001'
  order by due_date limit 1;

  v_r1 := public.record_collection(
    'eb000000-0000-0000-0000-000000000001',
    'ea000000-0000-0000-0000-000000000001',
    v_due.amount_due, 'cash', now(), 'brouillon 1',
    jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', v_due.amount_due)),
    null::text -- p_reference : lève l'ambiguïté entre les deux surcharges
  );
  v_r2 := public.record_collection(
    'eb000000-0000-0000-0000-000000000001',
    'ea000000-0000-0000-0000-000000000001',
    v_due.amount_due, 'cash', now(), 'brouillon 2',
    jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', v_due.amount_due)),
    null::text -- p_reference : lève l'ambiguïté entre les deux surcharges
  );

  -- Confirmation du premier : OK, échéance payée.
  perform public.confirm_collection(v_r1);
  if (select status from public.rent_dues where id = v_due.id) <> 'paid' then
    raise exception 'confirmation 1: échéance attendue paid';
  end if;

  -- Confirmation du second : refusée entièrement.
  begin
    perform public.confirm_collection(v_r2);
  exception when others then
    if sqlerrm not like '%allocation_exceeds_due_at_confirm%' then
      raise exception 'confirmation 2: erreur inattendue %', sqlerrm;
    end if;
    v_second_refused := true;
  end;
  if not v_second_refused then
    raise exception 'confirmation 2: aurait dû être refusée (allocation_exceeds_due_at_confirm)';
  end if;

  -- La réception 2 reste draft, rien de partiellement confirmé.
  if (select status from public.rent_receptions where id = v_r2) <> 'draft' then
    raise exception 'confirmation 2: la réception doit rester draft';
  end if;

  -- L'échéance ne dépasse jamais amount_paid > amount_due.
  select coalesce(sum(a.amount_allocated), 0) into v_paid
  from public.rent_reception_allocations a
  join public.rent_receptions r on r.id = a.rent_reception_id
  where a.rent_due_id = v_due.id
    and r.status = 'confirmed'
    and r.deleted_at is null;
  if v_paid > v_due.amount_due then
    raise exception 'invariant violé: confirmé % > dû %', v_paid, v_due.amount_due;
  end if;
end $$;

select 'confirm_collection_recheck: OK' as result;

rollback;
