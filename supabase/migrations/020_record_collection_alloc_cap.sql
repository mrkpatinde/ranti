-- ============================================================
-- Migration 020 : cap per-due allocation in record_collection
-- ============================================================
-- Audit P1: record_collection only checked sum(allocations) <= amount_received,
-- never that an allocation stays within a single due's remaining balance. So an
-- owner (or the API) could allocate 50 000 to a 30 000 due → silent trop-perçu,
-- amount_paid > amount_due, negative remaining. This adds a per-due cap:
-- amount_allocated <= amount_due - already-confirmed-paid.
-- Note: only CONFIRMED allocations count as already paid (consistent with
-- rent_due_balances); two concurrent drafts on the same due is still possible
-- and should be re-checked at confirm time (follow-up).

create or replace function public.record_collection(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_amount integer,
  p_method text,
  p_received_at timestamptz,
  p_note text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rid uuid;
  alloc_sum integer := 0;
  a jsonb;
  amt integer;
  due public.rent_dues;
  paid_already integer;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_invalid' using errcode = 'P0001'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'other') then
    raise exception 'method_invalid' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'allocation_required' using errcode = 'P0001';
  end if;

  perform 1 from public.tenants where id = p_tenant_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'tenant_not_found' using errcode = 'P0002'; end if;

  perform 1 from public.units where id = p_unit_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'unit_not_found' using errcode = 'P0002'; end if;

  for a in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb))
  loop
    amt := (a->>'amount_allocated')::int;
    if amt is null or amt <= 0 then raise exception 'allocation_invalid' using errcode = 'P0001'; end if;

    select * into due from public.rent_dues
    where id = (a->>'rent_due_id')::uuid and landlord_id = lid and deleted_at is null;
    if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
    if due.tenant_id <> p_tenant_id then raise exception 'due_tenant_mismatch' using errcode = 'P0001'; end if;
    if due.unit_id <> p_unit_id then raise exception 'due_unit_mismatch' using errcode = 'P0001'; end if;
    if due.status = 'cancelled' then raise exception 'due_cancelled' using errcode = 'P0001'; end if;

    -- Per-due cap: cannot allocate more than what is still owed on this due.
    select coalesce(sum(al.amount_allocated), 0) into paid_already
    from public.rent_reception_allocations al
    join public.rent_receptions r on r.id = al.rent_reception_id
    where al.rent_due_id = due.id
      and r.status = 'confirmed'
      and r.deleted_at is null;

    if amt > (due.amount_due - paid_already) then
      raise exception 'allocation_exceeds_due' using errcode = 'P0001';
    end if;

    alloc_sum := alloc_sum + amt;
  end loop;

  if alloc_sum > p_amount then
    raise exception 'allocations_exceed_amount' using errcode = 'P0001';
  end if;

  insert into public.rent_receptions (
    landlord_id, tenant_id, unit_id, received_at, amount_received, currency,
    payment_method, status, note
  )
  values (
    lid, p_tenant_id, p_unit_id, coalesce(p_received_at, now()), p_amount, 'XOF',
    p_method, 'draft', p_note
  )
  returning id into rid;

  insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
  select lid, rid, (el->>'rent_due_id')::uuid, (el->>'amount_allocated')::int
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as el;

  return rid;
end;
$$;

revoke all on function public.record_collection(uuid, uuid, integer, text, timestamptz, text, jsonb) from public, anon;
grant execute on function public.record_collection(uuid, uuid, integer, text, timestamptz, text, jsonb) to authenticated;
