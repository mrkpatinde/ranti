-- Relances programmees par le proprietaire (demande du 2026-07-18 : « je dois
-- pouvoir programmer une relance », au-dela de la cadence automatique).
--
-- Une relance programmee = une ligne (echeance, date choisie, canal) que
-- ranti-ops lit dans sa file (meme doctrine qu'ops_reminder_queue : l'envoi
-- vit chez l'operateur, ADR-022). Annulable par le proprietaire tant qu'elle
-- est pending. Ecritures via RPC (invariants : appartenance de l'echeance,
-- date >= aujourd'hui, une seule pending par echeance+date) ; lecture directe
-- sous RLS.

begin;

create table public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete restrict,
  rent_due_id uuid not null references public.rent_dues(id) on delete restrict,
  scheduled_for date not null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz
);

comment on table public.scheduled_reminders is
  'Relances ponctuelles programmees par le proprietaire. ranti-ops envoie a la '
  'date choisie (ops_scheduled_reminders) puis marque sent ; annulable pending.';

create unique index scheduled_reminders_pending_uniq
  on public.scheduled_reminders(rent_due_id, scheduled_for)
  where status = 'pending';
create index scheduled_reminders_landlord_idx
  on public.scheduled_reminders(landlord_id, status);

alter table public.scheduled_reminders enable row level security;

create policy "Landlords read own scheduled reminders" on public.scheduled_reminders
  for select using (landlord_id = private.current_landlord_id());

grant select on public.scheduled_reminders to authenticated;
-- Aucun grant INSERT/UPDATE/DELETE : ecritures via RPC.

-- ── Programmer (RPC, invariants centralises) ────────────────────────────────

create function public.schedule_reminder(
  p_rent_due_id uuid,
  p_scheduled_for date,
  p_channel text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid := private.current_landlord_id();
  v_due public.rent_dues;
  v_id uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_channel not in ('whatsapp', 'sms') then
    raise exception 'channel_invalid' using errcode = 'P0001';
  end if;
  if p_scheduled_for is null or p_scheduled_for < current_date then
    raise exception 'date_past' using errcode = 'P0001';
  end if;

  select * into v_due from public.rent_dues
  where id = p_rent_due_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
  if v_due.status in ('paid', 'cancelled') then
    raise exception 'due_settled' using errcode = 'P0001';
  end if;

  insert into public.scheduled_reminders (landlord_id, rent_due_id, scheduled_for, channel)
  values (lid, p_rent_due_id, p_scheduled_for, p_channel)
  on conflict (rent_due_id, scheduled_for) where status = 'pending' do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'already_scheduled' using errcode = 'P0001';
  end if;

  return v_id;
end;
$$;

-- ── Annuler (pending seulement) ─────────────────────────────────────────────

create function public.cancel_scheduled_reminder(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid := private.current_landlord_id();
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;

  update public.scheduled_reminders
  set status = 'cancelled', cancelled_at = now()
  where id = p_id and landlord_id = lid and status = 'pending';

  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.schedule_reminder(uuid, date, text) to authenticated;
grant execute on function public.cancel_scheduled_reminder(uuid) to authenticated;

-- ── File ops : ce que ranti-ops doit envoyer (jamais lisible cote client) ───

create view public.ops_scheduled_reminders as
select
  sr.id,
  sr.scheduled_for,
  sr.channel,
  sr.created_at,
  l.phone as landlord_phone,
  concat_ws(' ', l.first_name, l.last_name) as landlord_name,
  t.phone as tenant_phone,
  concat_ws(' ', t.first_name, t.last_name) as tenant_name,
  u.name as unit_name,
  rd.due_date,
  greatest(0, rd.amount_due - coalesce(paid.total, 0)) as amount_remaining
from public.scheduled_reminders sr
join public.rent_dues rd on rd.id = sr.rent_due_id
join public.landlords l on l.id = sr.landlord_id
join public.tenants t on t.id = rd.tenant_id
join public.units u on u.id = rd.unit_id
left join lateral (
  select sum(a.amount_allocated) as total
  from public.rent_reception_allocations a
  join public.rent_receptions r on r.id = a.rent_reception_id
  where a.rent_due_id = rd.id and r.status = 'confirmed' and r.deleted_at is null
) paid on true
where sr.status = 'pending' and sr.scheduled_for <= current_date
order by sr.scheduled_for asc;

revoke all on table public.ops_scheduled_reminders from anon, authenticated;

commit;
