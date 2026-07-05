-- Tests du chemin d'écriture opérateur (T1/T2 sprint instrumentation).
-- Exécution : psql/SQL editor. Chaque bloc est transactionnel et se ROLLBACK —
-- aucun effet persistant, exécutable sur n'importe quel environnement.

-- ---------------------------------------------------------------------------
-- Bloc 1 : happy path opérateur + régression wrapper landlord + vue sprint
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_due record;
  v_rid uuid;
  v_rec record;
  v_audit_count int;
begin
  select rd.* into v_due from rent_dues rd
  where rd.status in ('expected','overdue') and rd.deleted_at is null
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
      jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', 1000)));
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
