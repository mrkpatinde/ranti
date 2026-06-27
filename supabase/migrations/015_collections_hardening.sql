-- Ranti: collections hardening (corrective review of PR #33)
-- Target: PostgreSQL 17 / Supabase
-- Scope: tighten record_collection and lock dues during status recompute.
--
-- Corrections (api.md Rent Receptions + product MVP "qui a payé / qui doit") :
--   1. Une réception doit porter au moins une allocation. Un encaissement sans
--      allocation crée de l'argent reçu qui ne réduit aucune dette : interdit
--      par une erreur métier explicite (allocation_required). Le surplus reste
--      autorisé (alloc_sum <= p_amount), seul le zéro-allocation est refusé.
--   2. Chaque échéance allouée doit appartenir AU logement encaissé, pas
--      seulement au locataire (due.unit_id = p_unit_id). Empêche d'imputer un
--      paiement du logement A sur une échéance du même locataire au logement B.
--   3. Concurrence : recompute_rent_due_status verrouille la ligne rent_dues
--      (FOR UPDATE) et confirm/cancel verrouillent la réception, pour éviter
--      les recalculs de statut incohérents lors d'opérations simultanées.
-- Functions stay SECURITY INVOKER, so RLS continues to apply.

-- -----------------------------------------------------------------------------
-- Recompute a single due status from its confirmed allocations (locked row)
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
  -- Lock the due row for the duration of the transaction so two concurrent
  -- confirmations/cancellations cannot interleave reads and writes on it.
  select * into due from public.rent_dues where id = p_due_id for update;
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
-- record_collection: require >=1 allocation; verify due belongs to the unit
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

  -- An encaissement must reduce at least one debt, otherwise it is money
  -- received that settles nothing (invisible to "qui doit").
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
-- confirm_collection: lock the reception row to serialize concurrent confirms
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
  where id = p_reception_id and landlord_id = lid and deleted_at is null
  for update;
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
-- cancel_collection: lock the reception row to serialize concurrent cancels
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
  where id = p_reception_id and landlord_id = lid and deleted_at is null
  for update;
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
