-- ADR-014 — journal_feed enrichi pour l'écran Journal.
--
-- Ajoute les colonnes d'affichage dont la page a besoin (contrepartie =
-- locataire, logement, référence d'opérateur, drapeau alloué), pour que la vue
-- reste la seule source et la page un simple rendu. security_invoker inchangé :
-- les jointures tenants/units/leases respectent la RLS du propriétaire.

begin;

create or replace view public.journal_feed
with (security_invoker = true) as
  -- Bail pris en compte
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
    null::boolean                        as allocated
  from public.leases l
  left join public.tenants t on t.id = l.tenant_id
  left join public.units u on u.id = l.unit_id
  where l.deleted_at is null and l.status in ('active', 'ended')

  union all

  -- Loyer attendu
  select
    d.landlord_id, 'rent_due', d.due_date::timestamptz, 'Loyer attendu',
    d.amount_due, d.currency, 'rent_dues', d.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean
  from public.rent_dues d
  left join public.tenants t on t.id = d.tenant_id
  left join public.units u on u.id = d.unit_id
  where d.deleted_at is null and d.status <> 'cancelled'

  union all

  -- Encaissement (affecté ou non → Fast-Log)
  select
    r.landlord_id, 'rent_reception', r.received_at,
    case when exists (select 1 from public.rent_reception_allocations a where a.rent_reception_id = r.id)
         then 'Encaissement' else 'Encaissement non affecté' end,
    r.amount_received, r.currency, 'rent_receptions', r.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, r.payment_reference,
    exists (select 1 from public.rent_reception_allocations a where a.rent_reception_id = r.id)
  from public.rent_receptions r
  left join public.tenants t on t.id = r.tenant_id
  left join public.units u on u.id = r.unit_id
  where r.deleted_at is null and r.status = 'confirmed'

  union all

  -- Quittance émise
  select
    q.landlord_id, 'receipt', q.issued_at, 'Quittance émise',
    q.total_amount, q.currency, 'receipts', q.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean
  from public.receipts q
  left join public.rent_receptions r on r.id = q.rent_reception_id
  left join public.tenants t on t.id = r.tenant_id
  left join public.units u on u.id = r.unit_id
  where q.deleted_at is null and q.status = 'issued'

  union all

  -- Relance automatique (SMS/WhatsApp)
  select
    m.landlord_id, 'reminder', m.sent_at, 'Relance envoyée',
    null::integer, null::text, 'reminders', m.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean
  from public.reminders m
  left join public.rent_dues d on d.id = m.rent_due_id
  left join public.tenants t on t.id = d.tenant_id
  left join public.units u on u.id = d.unit_id
  where m.status <> 'failed'

  union all

  -- Relance manuelle WhatsApp (cockpit opérateur)
  select
    e.landlord_id, 'reminder', e.sent_at, 'Relance envoyée',
    null::integer, null::text, 'reminder_events', e.id,
    nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    u.name, null::text, null::boolean
  from public.reminder_events e
  left join public.tenants t on t.id = e.tenant_id
  left join public.leases le on le.id = e.lease_id
  left join public.units u on u.id = le.unit_id;

grant select on public.journal_feed to authenticated;

commit;
