-- Tests du chemin d'écriture opérateur (T1/T2 sprint instrumentation).
-- Exécution : psql/SQL editor. Chaque bloc est transactionnel et se ROLLBACK —
-- aucun effet persistant, exécutable sur n'importe quel environnement.

-- ---------------------------------------------------------------------------
-- Bloc 1 : happy path opérateur + régression wrapper landlord + vue sprint
-- ---------------------------------------------------------------------------
begin;

-- Fixtures jetables (ROLLBACK final). Pas de claim JWT : la régression
-- wrapper landlord ci-dessous exige un contexte sans session.
insert into auth.users (id, instance_id, aud, role, email)
values ('ee111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ops-entry-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('ee222222-2222-2222-2222-222222222222',
        'ee111111-1111-1111-1111-111111111111',
        '+22990000098', 'Test', 'OpsEntry');

insert into public.properties (id, landlord_id, name)
values ('ee333333-3333-3333-3333-333333333333',
        'ee222222-2222-2222-2222-222222222222', 'Cour OpsEntry');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('ee444444-4444-4444-4444-444444444444','ee222222-2222-2222-2222-222222222222','ee333333-3333-3333-3333-333333333333','U1','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('ee555555-5555-5555-5555-555555555555','ee222222-2222-2222-2222-222222222222','Loc','OpsEntry','+22991000098');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, end_date, status)
values ('ee666666-6666-6666-6666-666666666666','ee222222-2222-2222-2222-222222222222','ee444444-4444-4444-4444-444444444444','ee555555-5555-5555-5555-555555555555',50000,5,date '2023-01-05',date '2023-03-03','active');

-- generate_rent_dues exige une session landlord : claim posé le temps de
-- l'appel puis effacé (la régression wrapper exige un contexte sans session).
select set_config('request.jwt.claim.sub',
                  'ee111111-1111-1111-1111-111111111111', true);
select public.generate_rent_dues('ee666666-6666-6666-6666-666666666666');
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_due record;
  v_rid uuid;
  v_rec record;
  v_audit_count int;
begin
  select rd.* into v_due from rent_dues rd
  where rd.lease_id = 'ee666666-6666-6666-6666-666666666666'
    and rd.status in ('expected','overdue') and rd.deleted_at is null
  order by rd.due_date limit 1;
  if v_due.id is null then raise exception 'TEST SETUP: no open due'; end if;

  -- Saisie opérateur : recorded_by/ref forcés, statut draft
  v_rid := public.ops_record_collection(
    v_due.landlord_id, v_due.tenant_id, v_due.unit_id, v_due.amount_due,
    'mobile_money', null, 'test rollback',
    jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', v_due.amount_due)),
    'TestOp');

  select * into v_rec from rent_receptions where id = v_rid;
  if v_rec.recorded_by <> 'operator' then raise exception 'FAIL: recorded_by=%', v_rec.recorded_by; end if;
  if v_rec.recorded_by_ref <> 'TestOp' then raise exception 'FAIL: recorded_by_ref=%', v_rec.recorded_by_ref; end if;
  if v_rec.status <> 'draft' then raise exception 'FAIL: status=%', v_rec.status; end if;

  -- Confirmation opérateur : statut confirmed, due recalculé paid
  perform public.ops_confirm_collection(v_due.landlord_id, v_rid, 'TestOp');
  select * into v_rec from rent_receptions where id = v_rid;
  if v_rec.status <> 'confirmed' then raise exception 'FAIL: confirm status=%', v_rec.status; end if;
  select status into v_rec from rent_dues where id = v_due.id;
  if v_rec.status <> 'paid' then raise exception 'FAIL: due status=%', v_rec.status; end if;

  -- Audit : 2 lignes avec actor_type=operator
  select count(*) into v_audit_count from audit_logs
  where entity_id = v_rid and action in ('ops.collection_recorded','ops.collection_confirmed')
    and metadata->>'actor_type' = 'operator';
  if v_audit_count <> 2 then raise exception 'FAIL: audit rows=%', v_audit_count; end if;

  -- Régression : wrapper landlord sans session → no_landlord (jamais 'operator')
  begin
    perform public.record_collection(v_due.tenant_id, v_due.unit_id, 1000, 'cash', null, null,
      jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', 1000)),
      null::text); -- p_reference : lève l'ambiguïté entre les deux surcharges
    raise exception 'FAIL: record_collection aurait dû lever no_landlord';
  exception when others then
    if sqlerrm not like '%no_landlord%' then raise exception 'FAIL: erreur inattendue %', sqlerrm; end if;
  end;

  -- Vue sprint : la saisie opérateur confirmée est comptée
  if (select operator_entries_30d from ops_sprint_metrics) < 1 then
    raise exception 'FAIL: ops_sprint_metrics ne voit pas la saisie opérateur';
  end if;

  raise notice 'BLOC 1 OK';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Bloc 2 : permissions — les RPC ops sont interdites au rôle authenticated
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
do $$
begin
  begin
    perform public.ops_record_collection('00000000-0000-0000-0000-000000000000'::uuid, null, null, 1, 'cash', null, null, '[]'::jsonb, 'x');
    raise exception 'FAIL: ops_record_collection accessible par authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ops_confirm_collection('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'x');
    raise exception 'FAIL: ops_confirm_collection accessible par authenticated';
  exception when insufficient_privilege then null;
  end;
  raise notice 'BLOC 2 OK';
end $$;
rollback;
