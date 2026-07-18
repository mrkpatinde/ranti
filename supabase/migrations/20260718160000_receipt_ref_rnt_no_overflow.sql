-- Correctif revue 2026-07-18 : la sequence RNT-AAAA-NNNN plafonnait a 9999.
-- lpad() Postgres TRONQUE quand le nombre depasse la longueur cible :
-- lpad('10000', 4, '0') = '1000', donc la 10 000e quittance d'une annee
-- produisait un numero deja pris (unique landlord_id + receipt_number) et
-- l'emission echouait definitivement pour ce proprietaire jusqu'au 1er janvier.
--
-- Fix : borne basse 4 chiffres, mais jamais de troncature au-dela
-- (greatest(4, length(n))). RNT-2026-0001 ... RNT-2026-9999, RNT-2026-10000.
-- Seule la ligne de generation du numero change ; le reste du corps est
-- reproduit a l'identique de 20260718130000_receipt_ref_rnt_year.sql.

begin;

create or replace function private.generate_receipt_core(p_landlord_id uuid, p_reception_id uuid)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  lid uuid := p_landlord_id;
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

  -- Idempotence : renvoyer le receipt ACTIF existant (pas un annule).
  select id into existing from public.receipts
  where rent_reception_id = p_reception_id
    and status = 'issued' and deleted_at is null;
  if existing is not null then
    return existing;
  end if;

  -- Serialize receipt-number generation per landlord (avoids count(*)+1 race).
  perform pg_advisory_xact_lock(hashtextextended(lid::text, 0));

  -- Reference RNT-AAAA-NNNN : sequence par proprietaire remise a zero par
  -- annee. Minimum 4 chiffres, jamais tronquee au-dela (lpad tronquerait).
  select 'RNT-' || to_char(now(), 'YYYY') || '-' ||
         lpad((count(*) + 1)::text,
              greatest(4, length((count(*) + 1)::text)), '0') into v_num
  from public.receipts
  where landlord_id = lid
    and receipt_number like ('RNT-' || to_char(now(), 'YYYY') || '-%');

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
$function$;

commit;
