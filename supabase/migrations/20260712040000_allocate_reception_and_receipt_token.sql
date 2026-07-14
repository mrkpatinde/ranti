-- Affecter un encaissement Fast-Log + lien de confirmation dans le journal.
--
-- 1) allocate_reception : affecter APRÈS coup un encaissement confirmé mais non
--    alloué (crédit Fast-Log, ADR-014) à des échéances. Réutilise exactement les
--    invariants de record_collection_core (montant ≤ reste dû, somme ≤ reçu).
--    Ne crée pas de nouvelle réception (pas de double comptage) : ajoute des
--    allocations à la réception existante puis recalcule le statut des échéances.
--    Le reçu déjà émis reste valable comme preuve du paiement reçu.
--
-- 2) journal_feed : expose le token du reçu (receipt_token) pour que la
--    notification WhatsApp sortante porte le lien /recu/[token] (le locataire
--    confirme le reçu et télécharge le PDF — preuve à deux voix ADR-013).

begin;

-- 1) allocate_reception -------------------------------------------------------
create or replace function public.allocate_reception(
  p_reception_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
set search_path to ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rec public.rent_receptions;
  a jsonb;
  amt integer;
  due public.rent_dues;
  paid_already integer;
  alloc_sum integer := 0;
  existing_sum integer;
  d uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;

  select * into rec from public.rent_receptions
  where id = p_reception_id and landlord_id = lid and deleted_at is null
  for update;
  if not found then raise exception 'reception_not_found' using errcode = 'P0002'; end if;
  if rec.status <> 'confirmed' then raise exception 'reception_not_confirmed' using errcode = 'P0001'; end if;

  if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'allocation_required' using errcode = 'P0001';
  end if;

  -- Allocations déjà posées sur cette réception (on complète, on n'écrase pas).
  select coalesce(sum(al.amount_allocated), 0) into existing_sum
  from public.rent_reception_allocations al
  where al.rent_reception_id = p_reception_id;

  for a in select * from jsonb_array_elements(p_allocations)
  loop
    amt := (a->>'amount_allocated')::int;
    if amt is null or amt <= 0 then raise exception 'allocation_invalid' using errcode = 'P0001'; end if;

    select * into due from public.rent_dues
    where id = (a->>'rent_due_id')::uuid and landlord_id = lid and deleted_at is null
    for update;
    if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
    if due.tenant_id <> rec.tenant_id then raise exception 'due_tenant_mismatch' using errcode = 'P0001'; end if;
    if due.unit_id <> rec.unit_id then raise exception 'due_unit_mismatch' using errcode = 'P0001'; end if;
    if due.status = 'cancelled' then raise exception 'due_cancelled' using errcode = 'P0001'; end if;

    -- Reste dû = montant - déjà confirmé (toutes réceptions confirmées, y
    -- compris celle-ci si elle porte déjà une allocation sur cette échéance).
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

  -- La somme allouée (existante + nouvelle) ne peut dépasser le montant reçu.
  if existing_sum + alloc_sum > rec.amount_received then
    raise exception 'allocations_exceed_amount' using errcode = 'P0001';
  end if;

  insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
  select lid, p_reception_id, (el->>'rent_due_id')::uuid, (el->>'amount_allocated')::int
  from jsonb_array_elements(p_allocations) as el;

  for d in select distinct (el->>'rent_due_id')::uuid from jsonb_array_elements(p_allocations) as el
  loop
    perform private.recompute_rent_due_status(d);
  end loop;
end;
$$;

revoke all on function public.allocate_reception(uuid, jsonb) from public, anon;
grant execute on function public.allocate_reception(uuid, jsonb) to authenticated;

-- 2) journal_feed + receipt_token (colonne ajoutée EN DERNIER) ----------------
create or replace view public.journal_feed
with (security_invoker = true) as
  select
    l.landlord_id                        as landlord_id,
    'lease_started'::text                as event_type,
    l.start_date::timestamptz            as occurred_at,
    'Nouveau bail'::text                 as label,
    l.monthly_rent_amount                as amount,
    l.currency                           as currency,
    'leases'::text                       as ref_table,
    l.id                                 as ref_id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), '') as counterparty,
    u.name                               as unit_label,
    null::text                           as reference,
    null::boolean                        as allocated,
    t.phone                              as counterparty_phone,
    null::uuid                           as receipt_token
  from public.leases l
  left join public.tenants t on t.id = l.tenant_id
  left join public.units u on u.id = l.unit_id
  where l.deleted_at is null and l.status in ('active', 'ended')

  union all

  select
    d.landlord_id, 'rent_due', d.due_date::timestamptz, 'Loyer attendu',
    d.amount_due, d.currency, 'rent_dues', d.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean, t.phone, null::uuid
  from public.rent_dues d
  left join public.tenants t on t.id = d.tenant_id
  left join public.units u on u.id = d.unit_id
  where d.deleted_at is null and d.status <> 'cancelled'

  union all

  -- Encaissement : porte le token du reçu émis pour la notification WhatsApp.
  select
    r.landlord_id, 'rent_reception', r.received_at,
    case when exists (select 1 from public.rent_reception_allocations a where a.rent_reception_id = r.id)
         then 'Encaissement' else 'Encaissement non affecté' end,
    r.amount_received, r.currency, 'rent_receptions', r.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, r.payment_reference,
    exists (select 1 from public.rent_reception_allocations a where a.rent_reception_id = r.id),
    t.phone,
    q.tenant_token
  from public.rent_receptions r
  left join public.tenants t on t.id = r.tenant_id
  left join public.units u on u.id = r.unit_id
  left join public.receipts q on q.rent_reception_id = r.id and q.status = 'issued' and q.deleted_at is null
  where r.deleted_at is null and r.status = 'confirmed'

  union all

  select
    q.landlord_id, 'receipt', q.issued_at, 'Quittance émise',
    q.total_amount, q.currency, 'receipts', q.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean, t.phone,
    q.tenant_token
  from public.receipts q
  left join public.rent_receptions r on r.id = q.rent_reception_id
  left join public.tenants t on t.id = r.tenant_id
  left join public.units u on u.id = r.unit_id
  where q.deleted_at is null and q.status = 'issued'

  union all

  select
    m.landlord_id, 'reminder', m.sent_at, 'Relance envoyée',
    null::integer, null::text, 'reminders', m.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean, t.phone, null::uuid
  from public.reminders m
  left join public.rent_dues d on d.id = m.rent_due_id
  left join public.tenants t on t.id = d.tenant_id
  left join public.units u on u.id = d.unit_id
  where m.status <> 'failed'

  union all

  select
    e.landlord_id, 'reminder', e.sent_at, 'Relance envoyée',
    null::integer, null::text, 'reminder_events', e.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean, t.phone, null::uuid
  from public.reminder_events e
  left join public.tenants t on t.id = e.tenant_id
  left join public.leases le on le.id = e.lease_id
  left join public.units u on u.id = le.unit_id;

grant select on public.journal_feed to authenticated;

commit;
