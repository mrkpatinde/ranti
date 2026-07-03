-- Ranti Ops — file de relances manuelles.
-- Projet séparé de l'app propriétaire. À appliquer sur la base Supabase Ranti.
-- Ce script s'appuie sur le schéma existant : landlords, properties, units,
-- tenants, leases et rent_dues.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Trace append-only des relances traitées manuellement par l'opérateur Ranti.
-- -----------------------------------------------------------------------------
create table if not exists public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  rent_due_id uuid not null references public.rent_dues(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('j_5', 'j_1', 'late_j_1', 'late_j_3')),
  channel text not null default 'whatsapp_manual' check (channel in ('whatsapp_manual')),
  message_body text not null,
  status text not null default 'sent' check (status in ('sent')),
  sent_by text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (rent_due_id, tenant_id, reminder_type)
);

create index if not exists reminder_events_landlord_id_idx on public.reminder_events(landlord_id);
create index if not exists reminder_events_tenant_id_idx on public.reminder_events(tenant_id);
create index if not exists reminder_events_rent_due_id_idx on public.reminder_events(rent_due_id);
create index if not exists reminder_events_sent_at_idx on public.reminder_events(sent_at desc);

-- Ne pas exposer aux rôles client Supabase. Ranti Ops utilise la service role key
-- uniquement côté serveur.
revoke all on table public.reminder_events from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Vue opérationnelle : échéances non payées à relancer dans les fenêtres retenues.
-- On relance une échéance de loyer (rent_dues), pas directement un bail.
-- -----------------------------------------------------------------------------
create or replace view public.ops_reminder_queue as
with candidates as (
  select
    rd.id as rent_due_id,
    rd.lease_id,
    rd.landlord_id,
    rd.tenant_id,
    l.phone as landlord_phone,
    concat_ws(' ', l.first_name, l.last_name) as landlord_name,
    p.name as property_name,
    u.name as unit_name,
    u.unit_type,
    t.phone as tenant_phone,
    concat_ws(' ', t.first_name, t.last_name) as tenant_name,
    rd.period_start,
    rd.period_end,
    rd.amount_due,
    rd.currency,
    rd.due_date,
    rd.status as rent_due_status,
    (current_date - rd.due_date) as days_from_due_date,
    case
      when rd.due_date = current_date + 5 then 'j_5'
      when rd.due_date = current_date + 1 then 'j_1'
      when rd.due_date = current_date - 1 then 'late_j_1'
      when rd.due_date = current_date - 3 then 'late_j_3'
      else null
    end as reminder_type,
    last_event.last_reminder_sent_at
  from public.rent_dues rd
  join public.leases lease on lease.id = rd.lease_id
  join public.landlords l on l.id = rd.landlord_id
  join public.units u on u.id = rd.unit_id
  left join public.properties p on p.id = u.property_id
  join public.tenants t on t.id = rd.tenant_id
  left join lateral (
    select max(re.sent_at) as last_reminder_sent_at
    from public.reminder_events re
    where re.rent_due_id = rd.id
      and re.tenant_id = rd.tenant_id
  ) last_event on true
  where lease.status = 'active'
    and lease.deleted_at is null
    and rd.deleted_at is null
    and rd.status in ('expected', 'overdue')
    and rd.due_date in (current_date + 5, current_date + 1, current_date - 1, current_date - 3)
)
select
  rent_due_id,
  lease_id,
  landlord_id,
  tenant_id,
  landlord_name,
  landlord_phone,
  property_name,
  unit_name,
  unit_type,
  tenant_name,
  tenant_phone,
  period_start,
  period_end,
  amount_due,
  currency,
  due_date,
  rent_due_status,
  reminder_type,
  days_from_due_date,
  last_reminder_sent_at,
  case
    when reminder_type in ('j_5', 'j_1') then
      'Bonjour ' || tenant_name || ', petit rappel concernant votre loyer. L’échéance est prévue le ' || due_date::text || '. Merci de procéder au paiement ou d’envoyer la preuve si cela a déjà été fait.'
    else
      'Bonjour ' || tenant_name || ', sauf erreur, le loyer prévu le ' || due_date::text || ' n’apparaît pas encore comme payé dans le registre. Merci de régulariser ou d’envoyer la preuve de paiement si cela a déjà été fait.'
  end as suggested_message
from candidates c
where reminder_type is not null
  and not exists (
    select 1
    from public.reminder_events re
    where re.rent_due_id = c.rent_due_id
      and re.tenant_id = c.tenant_id
      and re.reminder_type = c.reminder_type
  );

revoke all on table public.ops_reminder_queue from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Historique récent pour l'interface Ranti Ops.
-- -----------------------------------------------------------------------------
create or replace view public.ops_reminder_history as
select
  re.id,
  re.lease_id,
  re.rent_due_id,
  re.landlord_id,
  re.tenant_id,
  concat_ws(' ', l.first_name, l.last_name) as landlord_name,
  l.phone as landlord_phone,
  concat_ws(' ', t.first_name, t.last_name) as tenant_name,
  t.phone as tenant_phone,
  u.name as unit_name,
  p.name as property_name,
  rd.period_start,
  rd.period_end,
  rd.due_date,
  re.reminder_type,
  re.channel,
  re.status,
  re.sent_by,
  re.sent_at,
  re.created_at
from public.reminder_events re
join public.landlords l on l.id = re.landlord_id
join public.tenants t on t.id = re.tenant_id
join public.rent_dues rd on rd.id = re.rent_due_id
join public.units u on u.id = rd.unit_id
left join public.properties p on p.id = u.property_id;

revoke all on table public.ops_reminder_history from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Audit minimal : une ligne audit_logs est créée quand l'opérateur marque
-- une relance comme envoyée. La table audit_logs existe déjà dans le schéma Ranti.
-- -----------------------------------------------------------------------------
create or replace function public.audit_manual_reminder_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    landlord_id,
    actor_landlord_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    new.landlord_id,
    null,
    'ops.manual_reminder_sent',
    'reminder_event',
    new.id,
    jsonb_build_object(
      'lease_id', new.lease_id,
      'rent_due_id', new.rent_due_id,
      'tenant_id', new.tenant_id,
      'reminder_type', new.reminder_type,
      'channel', new.channel,
      'sent_by', new.sent_by,
      'sent_at', new.sent_at
    )
  );

  return new;
end;
$$;

drop trigger if exists reminder_events_audit_insert on public.reminder_events;
create trigger reminder_events_audit_insert
after insert on public.reminder_events
for each row execute function public.audit_manual_reminder_event();

revoke all on function public.audit_manual_reminder_event() from public, anon, authenticated;
