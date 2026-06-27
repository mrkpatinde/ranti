-- Ranti: receipt vs quittance distinction
-- Target: PostgreSQL 17 / Supabase
-- A "quittance de loyer" certifies the rent is fully paid. A partial payment
-- must produce a "reçu de paiement" (receipt), never a quittance. generate_receipt
-- now derives kind: quittance only when every due allocated by this confirmed
-- reception is fully paid (status = 'paid'); otherwise receipt.

alter table public.receipts
  add column if not exists kind text not null default 'receipt'
  check (kind in ('receipt', 'quittance'));

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
  v_kind text;
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

  -- Quittance only if every allocated due is fully paid; else a receipt.
  select case
           when bool_and(d.status = 'paid') then 'quittance'
           else 'receipt'
         end
    into v_kind
  from public.rent_reception_allocations a
  join public.rent_dues d on d.id = a.rent_due_id
  where a.rent_reception_id = rec.id;
  v_kind := coalesce(v_kind, 'receipt');

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
    landlord_id, rent_reception_id, receipt_number, total_amount, currency, status, kind, snapshot
  )
  values (
    lid, p_reception_id, v_num, rec.amount_received, rec.currency, 'issued', v_kind, v_snapshot
  )
  returning id into rid;

  return rid;
end;
$$;

revoke all on function public.generate_receipt(uuid) from public, anon;
grant execute on function public.generate_receipt(uuid) to authenticated;
