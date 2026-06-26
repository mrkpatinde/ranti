-- Ranti: rent collections (encaissements)
-- Target: PostgreSQL 17 / Supabase
-- Scope: record / confirm / cancel a rent reception with allocations to dues
--
-- api.md (Rent Receptions): a reception can settle one or more dues; the sum of
-- allocations cannot exceed the amount received; the landlord owns the tenant and
-- every allocated due; confirmation updates due statuses; cancel is refused once a
-- receipt exists and recomputes affected dues. All transactional + audited.
-- A due is `paid` only when its confirmed allocations cover amount_due (partial is
-- derived, never a status). Functions are SECURITY INVOKER, so RLS applies.

-- -----------------------------------------------------------------------------
-- Recompute a single due status from its confirmed allocations
-- -----------------------------------------------------------------------------
create or replace function private.recompute_rent_due_status(p_due_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  due public.rent_dues;
  paid integer;
begin
  select * into due from public.rent_dues where id = p_due_id;
  if not found or due.status = 'cancelled' then
    return;
  end if;

  select coalesce(sum(a.amount_allocated), 0) into paid
  from public.rent_reception_allocations a
  join public.rent_receptions r on r.id = a.rent_reception_id
  where a.rent_due_id = p_due_id
    and r.status = 'confirmed'
    and r.deleted_at is null;

  if paid >= due.amount_due then
    update public.rent_dues set status = 'paid' where id = p_due_id and status <> 'paid';
  else
    update public.rent_dues
    set status = case when due.due_date < current_date then 'overdue' else 'expected' end
    where id = p_due_id and status <> case when due.due_date < current_date then 'overdue' else 'expected' end;
  end if;
end;
$$;

revoke all on function private.recompute_rent_due_status(uuid) from public, anon;
grant execute on function private.recompute_rent_due_status(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- record_collection: create a draft reception + its allocations
-- p_allocations = jsonb array of { "rent_due_id": uuid, "amount_allocated": int }
-- -----------------------------------------------------------------------------
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
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_invalid' using errcode = 'P0001'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'other') then
    raise exception 'method_invalid' using errcode = 'P0001';
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
    if due.status = 'cancelled' then raise exception 'due_cancelled' using errcode = 'P0001'; end if;

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

-- -----------------------------------------------------------------------------
-- confirm_collection: draft -> confirmed; recompute allocated dues
-- -----------------------------------------------------------------------------
create or replace function public.confirm_collection(p_reception_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rec public.rent_receptions;
  d uuid;
begin
  select * into rec from public.rent_receptions
  where id = p_reception_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'reception_not_found' using errcode = 'P0002'; end if;
  if rec.status = 'confirmed' then return; end if;
  if rec.status = 'cancelled' then raise exception 'reception_cancelled' using errcode = 'P0001'; end if;

  update public.rent_receptions
  set status = 'confirmed', confirmed_at = now()
  where id = p_reception_id;

  for d in select rent_due_id from public.rent_reception_allocations where rent_reception_id = p_reception_id
  loop
    perform private.recompute_rent_due_status(d);
  end loop;
end;
$$;

revoke all on function public.confirm_collection(uuid) from public, anon;
grant execute on function public.confirm_collection(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- cancel_collection: refuse if a receipt exists; recompute affected dues
-- -----------------------------------------------------------------------------
create or replace function public.cancel_collection(p_reception_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rec public.rent_receptions;
  d uuid;
begin
  select * into rec from public.rent_receptions
  where id = p_reception_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'reception_not_found' using errcode = 'P0002'; end if;
  if rec.status = 'cancelled' then return; end if;

  if exists (
    select 1 from public.receipts
    where rent_reception_id = p_reception_id and status <> 'cancelled' and deleted_at is null
  ) then
    raise exception 'reception_has_receipt' using errcode = 'P0001';
  end if;

  update public.rent_receptions
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = p_reception_id;

  for d in select rent_due_id from public.rent_reception_allocations where rent_reception_id = p_reception_id
  loop
    perform private.recompute_rent_due_status(d);
  end loop;
end;
$$;

revoke all on function public.cancel_collection(uuid, text) from public, anon;
grant execute on function public.cancel_collection(uuid, text) to authenticated;
