-- Extension des relances programmees aux CHARGES du grand livre (decision du
-- 2026-07-18, suite : « une dette validee par le locataire merite le meme
-- outil de recouvrement »). Une relance programmee vise desormais SOIT une
-- echeance de loyer (rent_due_id), SOIT une charge validee (charge_id,
-- transactions type reparation|frais). Le message ops n'emploie jamais
-- « votre loyer » pour une charge : la file porte kind + libelle.

begin;

alter table public.scheduled_reminders
  alter column rent_due_id drop not null;
alter table public.scheduled_reminders
  add column charge_id uuid references public.transactions(id) on delete restrict;
alter table public.scheduled_reminders
  add constraint scheduled_reminders_one_target
    check (num_nonnulls(rent_due_id, charge_id) = 1);

create unique index scheduled_reminders_charge_pending_uniq
  on public.scheduled_reminders(charge_id, scheduled_for)
  where status = 'pending';

-- ── Programmer une relance de charge ────────────────────────────────────────

create function public.schedule_charge_reminder(
  p_charge_id uuid,
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
  v_tx public.transactions;
  v_id uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_channel not in ('whatsapp', 'sms') then
    raise exception 'channel_invalid' using errcode = 'P0001';
  end if;
  if p_scheduled_for is null or p_scheduled_for < current_date then
    raise exception 'date_past' using errcode = 'P0001';
  end if;

  select * into v_tx from public.transactions
  where id = p_charge_id and landlord_id = lid;
  if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
  -- Seule une charge (debit variable) VALIDEE par le locataire se relance :
  -- pending n'est pas encore une dette certaine, disputed est en litige
  -- (Ranti documente, ne presse pas), withdrawn/remplacee n'existe plus.
  if v_tx.type not in ('reparation', 'frais') or v_tx.direction <> 'debit' then
    raise exception 'not_a_charge' using errcode = 'P0001';
  end if;
  if v_tx.status <> 'validated' or v_tx.replaced_by is not null then
    raise exception 'charge_not_validated' using errcode = 'P0001';
  end if;

  insert into public.scheduled_reminders (landlord_id, charge_id, scheduled_for, channel)
  values (lid, p_charge_id, p_scheduled_for, p_channel)
  on conflict (charge_id, scheduled_for) where status = 'pending' do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'already_scheduled' using errcode = 'P0001';
  end if;

  return v_id;
end;
$$;

grant execute on function public.schedule_charge_reminder(uuid, date, text) to authenticated;

-- ── File ops : loyers ET charges, avec kind + libelle ───────────────────────

drop view public.ops_scheduled_reminders;
create view public.ops_scheduled_reminders as
select
  sr.id,
  sr.scheduled_for,
  sr.channel,
  sr.created_at,
  'loyer'::text as kind,
  null::text as charge_label,
  -- Tout premier contact de Ranti avec ce locataire : l'operateur DOIT ouvrir
  -- par la presentation de Ranti et du processus (decision 2026-07-18).
  (not exists (
     select 1 from public.reminders rm
     join public.rent_dues rd2 on rd2.id = rm.rent_due_id
     where rd2.tenant_id = rd.tenant_id
   ) and not exists (
     select 1 from public.reminder_events ev where ev.tenant_id = rd.tenant_id
   )) as first_contact,
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
where sr.status = 'pending' and sr.scheduled_for <= current_date and sr.rent_due_id is not null

union all

select
  sr.id,
  sr.scheduled_for,
  sr.channel,
  sr.created_at,
  'charge'::text as kind,
  tx.label as charge_label,
  (not exists (
     select 1 from public.reminders rm
     join public.rent_dues rd2 on rd2.id = rm.rent_due_id
     where rd2.tenant_id = le.tenant_id
   ) and not exists (
     select 1 from public.reminder_events ev where ev.tenant_id = le.tenant_id
   )) as first_contact,
  l.phone as landlord_phone,
  concat_ws(' ', l.first_name, l.last_name) as landlord_name,
  t.phone as tenant_phone,
  concat_ws(' ', t.first_name, t.last_name) as tenant_name,
  u.name as unit_name,
  tx.due_date,
  tx.amount as amount_remaining
from public.scheduled_reminders sr
join public.transactions tx on tx.id = sr.charge_id
join public.leases le on le.id = tx.lease_id
join public.landlords l on l.id = sr.landlord_id
join public.tenants t on t.id = le.tenant_id
join public.units u on u.id = le.unit_id
where sr.status = 'pending' and sr.scheduled_for <= current_date and sr.charge_id is not null

order by scheduled_for asc;

revoke all on table public.ops_scheduled_reminders from anon, authenticated;

commit;
