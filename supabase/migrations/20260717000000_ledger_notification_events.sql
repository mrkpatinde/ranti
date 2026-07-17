-- Notifications du Grand Livre (ADR-023, phase « différenciant » côté ops).
-- Rapatrié depuis prod (supabase_migrations.schema_migrations version
-- 20260716221557, appliquée via MCP le 2026-07-16) lors du calibrage repo↔prod
-- du 2026-07-17. Historiquement destiné au repo ranti-ops, mais appliqué sur la
-- MÊME base prod — le repo produit doit donc le porter pour que le schéma local
-- reflète la prod. Contenu identique à la prod, à l'octet près.

create table if not exists public.ledger_notification_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id),
  lease_id uuid not null references public.leases(id),
  tenant_id uuid not null references public.tenants(id),
  landlord_id uuid not null references public.landlords(id),
  kind text not null check (kind in ('validation_requested', 'disputed')),
  channel text not null default 'whatsapp_manual' check (channel in ('whatsapp_manual')),
  message_body text not null,
  status text not null default 'sent' check (status in ('sent')),
  sent_by text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ledger_notification_events_transaction_idx
  on public.ledger_notification_events(transaction_id);
create index if not exists ledger_notification_events_landlord_idx
  on public.ledger_notification_events(landlord_id);
create index if not exists ledger_notification_events_sent_at_idx
  on public.ledger_notification_events(sent_at desc);

alter table public.ledger_notification_events enable row level security;
revoke all on table public.ledger_notification_events from anon, authenticated;

create or replace view public.ops_ledger_notification_queue as
select
  n.transaction_id,
  n.kind,
  n.status,
  n.label,
  n.amount,
  n.currency,
  n.type,
  n.tenant_token,
  n.event_at,
  n.landlord_id,
  n.landlord_first_name,
  n.landlord_last_name,
  n.landlord_phone,
  n.tenant_first_name,
  n.tenant_last_name,
  n.tenant_phone,
  n.unit_name,
  tx.lease_id,
  le.tenant_id,
  ev.last_sent_at
from public.ops_ledger_notifications n
join public.transactions tx on tx.id = n.transaction_id
join public.leases le on le.id = tx.lease_id
left join lateral (
  select max(e.sent_at) as last_sent_at
  from public.ledger_notification_events e
  where e.transaction_id = n.transaction_id
    and e.kind = n.kind
) ev on true
where not exists (
  select 1
  from public.ledger_notification_events e
  where e.transaction_id = n.transaction_id
    and e.kind = n.kind
    and e.sent_at > now() - interval '7 days'
);

revoke all on table public.ops_ledger_notification_queue from anon, authenticated;
