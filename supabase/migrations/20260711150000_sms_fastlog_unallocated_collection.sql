-- ADR-014 — Fast-Log : encaissement SMS non affecté (crédit au bail).
--
-- Le collage SMS enregistre l'argent qui arrive sans forcer l'allocation aux
-- échéances : le paiement est un crédit non affecté, alloué plus tard depuis le
-- journal. record_collection accepte donc des allocations vides + une référence
-- d'opérateur (payment_reference) dont l'unicité partielle (migration
-- 20260711140000) déclenche la déduplication.
--
-- Compatibilité : le nouveau paramètre p_reference est ajouté EN FIN de
-- signature avec défaut null → tous les appelants existants (formulaire
-- /collections/new, wrappers ops) restent valides sans modification.

begin;

-- 1) Cœur : fast-log + référence + déduplication -----------------------------
create or replace function private.record_collection_core(
  p_landlord_id uuid,
  p_tenant_id uuid,
  p_unit_id uuid,
  p_amount integer,
  p_method text,
  p_received_at timestamp with time zone,
  p_note text,
  p_allocations jsonb,
  p_recorded_by text,
  p_recorded_by_ref text,
  p_reference text default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  lid uuid := p_landlord_id;
  rid uuid;
  alloc_sum integer := 0;
  a jsonb;
  amt integer;
  due public.rent_dues;
  paid_already integer;
  has_allocations boolean;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_invalid' using errcode = 'P0001'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'other') then
    raise exception 'method_invalid' using errcode = 'P0001';
  end if;
  if p_recorded_by not in ('landlord', 'operator') then
    raise exception 'recorded_by_invalid' using errcode = 'P0001';
  end if;

  has_allocations := jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) > 0;

  perform 1 from public.tenants where id = p_tenant_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'tenant_not_found' using errcode = 'P0002'; end if;

  perform 1 from public.units where id = p_unit_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'unit_not_found' using errcode = 'P0002'; end if;

  -- Chemin alloué (formulaire) : validation inchangée. Chemin fast-log
  -- (allocations vides) : on saute entièrement la validation d'échéance.
  if has_allocations then
    for a in select * from jsonb_array_elements(p_allocations)
    loop
      amt := (a->>'amount_allocated')::int;
      if amt is null or amt <= 0 then raise exception 'allocation_invalid' using errcode = 'P0001'; end if;

      select * into due from public.rent_dues
      where id = (a->>'rent_due_id')::uuid and landlord_id = lid and deleted_at is null;
      if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
      if due.tenant_id <> p_tenant_id then raise exception 'due_tenant_mismatch' using errcode = 'P0001'; end if;
      if due.unit_id <> p_unit_id then raise exception 'due_unit_mismatch' using errcode = 'P0001'; end if;
      if due.status = 'cancelled' then raise exception 'due_cancelled' using errcode = 'P0001'; end if;

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
  end if;

  -- Insertion + déduplication : une même payment_reference (par propriétaire)
  -- lève 23505 → on renvoie une erreur métier dédiée que le client intercepte.
  begin
    insert into public.rent_receptions (
      landlord_id, tenant_id, unit_id, received_at, amount_received, currency,
      payment_method, status, note, recorded_by, recorded_by_ref, payment_reference
    )
    values (
      lid, p_tenant_id, p_unit_id, coalesce(p_received_at, now()), p_amount, 'XOF',
      p_method, 'draft', p_note, p_recorded_by, p_recorded_by_ref, p_reference
    )
    returning id into rid;
  exception when unique_violation then
    raise exception 'DUPLICATE_PAYMENT' using errcode = 'P0001';
  end;

  if has_allocations then
    insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
    select lid, rid, (el->>'rent_due_id')::uuid, (el->>'amount_allocated')::int
    from jsonb_array_elements(p_allocations) as el;
  end if;

  return rid;
end;
$function$;

-- 2) Wrapper public : expose p_reference (invoker = propriétaire) ------------
create or replace function public.record_collection(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_amount integer,
  p_method text,
  p_received_at timestamp with time zone,
  p_note text,
  p_allocations jsonb,
  p_reference text default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
begin
  return private.record_collection_core(
    private.current_landlord_id(),
    p_tenant_id, p_unit_id, p_amount, p_method, p_received_at, p_note,
    p_allocations, 'landlord', null, p_reference
  );
end;
$function$;

-- 3) journal_feed : distinguer l'encaissement non affecté --------------------
create or replace view public.journal_feed
with (security_invoker = true) as
  select l.landlord_id as landlord_id, 'lease_started'::text as event_type,
         l.start_date::timestamptz as occurred_at, 'Bail pris en compte'::text as label,
         l.monthly_rent_amount as amount, l.currency as currency,
         'leases'::text as ref_table, l.id as ref_id
  from public.leases l
  where l.deleted_at is null and l.status in ('active', 'ended')
  union all
  select d.landlord_id, 'rent_due', d.due_date::timestamptz, 'Loyer attendu',
         d.amount_due, d.currency, 'rent_dues', d.id
  from public.rent_dues d
  where d.deleted_at is null and d.status <> 'cancelled'
  union all
  select r.landlord_id, 'rent_reception', r.received_at,
         case when exists (
           select 1 from public.rent_reception_allocations a where a.rent_reception_id = r.id
         ) then 'Encaissement' else 'Encaissement non affecté' end,
         r.amount_received, r.currency, 'rent_receptions', r.id
  from public.rent_receptions r
  where r.deleted_at is null and r.status = 'confirmed'
  union all
  select q.landlord_id, 'receipt', q.issued_at, 'Quittance émise',
         q.total_amount, q.currency, 'receipts', q.id
  from public.receipts q
  where q.deleted_at is null and q.status = 'issued'
  union all
  select m.landlord_id, 'reminder', m.sent_at, 'Relance envoyée',
         null::integer, null::text, 'reminders', m.id
  from public.reminders m
  where m.status <> 'failed'
  union all
  select e.landlord_id, 'reminder', e.sent_at, 'Relance envoyée',
         null::integer, null::text, 'reminder_events', e.id
  from public.reminder_events e;

grant select on public.journal_feed to authenticated;

commit;
