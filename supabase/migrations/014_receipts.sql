-- Ranti: receipts (quittances)
-- Target: PostgreSQL 17 / Supabase
-- Scope: generate / cancel a receipt from a confirmed reception
--
-- api.md (Receipts): a receipt is generated only from a CONFIRMED reception
-- (invariant #3), has a unique number per landlord, captures a deterministic
-- snapshot of the data used, and is never silently modified. Cancel keeps the row.
-- PDF generation is an external adapter (out of scope here; pdf_storage_path stays
-- null for now). Functions are SECURITY INVOKER (RLS applies); audited via triggers.

-- Deterministic snapshot of the data used to generate the receipt.
alter table public.receipts add column if not exists snapshot jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- generate_receipt: from a confirmed reception. Idempotent (one receipt per
-- reception via the unique rent_reception_id).
-- -----------------------------------------------------------------------------
create or replace function public.generate_receipt(p_reception_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rec public.rent_receptions;
  existing uuid;
  v_num text;
  v_snapshot jsonb;
  rid uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;

  select * into rec from public.rent_receptions
  where id = p_reception_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'reception_not_found' using errcode = 'P0002'; end if;
  if rec.status <> 'confirmed' then
    raise exception 'reception_not_confirmed' using errcode = 'P0001';
  end if;

  select id into existing from public.receipts where rent_reception_id = p_reception_id;
  if existing is not null then
    return existing;
  end if;

  select 'R-' || lpad((count(*) + 1)::text, 6, '0') into v_num
  from public.receipts where landlord_id = lid;

  v_snapshot := jsonb_build_object(
    'tenant', (
      select jsonb_build_object('first_name', first_name, 'last_name', last_name, 'phone', phone)
      from public.tenants where id = rec.tenant_id
    ),
    'unit', (
      select jsonb_build_object('name', name, 'type', unit_type)
      from public.units where id = rec.unit_id
    ),
    'reception', jsonb_build_object(
      'amount_received', rec.amount_received,
      'currency', rec.currency,
      'payment_method', rec.payment_method,
      'received_at', rec.received_at
    ),
    'allocations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'period_start', d.period_start,
          'period_end', d.period_end,
          'amount_allocated', a.amount_allocated
        ) order by d.period_start
      )
      from public.rent_reception_allocations a
      join public.rent_dues d on d.id = a.rent_due_id
      where a.rent_reception_id = rec.id
    ), '[]'::jsonb)
  );

  insert into public.receipts (
    landlord_id, rent_reception_id, receipt_number, total_amount, currency, status, snapshot
  )
  values (
    lid, p_reception_id, v_num, rec.amount_received, rec.currency, 'issued', v_snapshot
  )
  returning id into rid;

  return rid;
end;
$$;

revoke all on function public.generate_receipt(uuid) from public, anon;
grant execute on function public.generate_receipt(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- cancel_receipt: mark a receipt cancelled (with trace). Never physically deletes.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_receipt(p_receipt_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rec public.receipts;
begin
  select * into rec from public.receipts
  where id = p_receipt_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'receipt_not_found' using errcode = 'P0002'; end if;
  if rec.status = 'cancelled' then return; end if;

  update public.receipts
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = p_receipt_id;
end;
$$;

revoke all on function public.cancel_receipt(uuid, text) from public, anon;
grant execute on function public.cancel_receipt(uuid, text) to authenticated;
