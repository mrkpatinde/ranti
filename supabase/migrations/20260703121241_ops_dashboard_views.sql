-- Ranti Ops — vues du cockpit opérateur.
-- Rapatriées depuis ranti-ops (appliquées en live le 2026-07-03) pour que ce
-- repo reste la source de vérité des migrations : `supabase db reset` rejoue
-- tout, y compris le schéma ops.
-- Accès : service_role uniquement (aucun grant anon/authenticated).

create or replace view public.ops_portfolio_stats as
select
  (select count(*) from landlords where deleted_at is null) as landlords_count,
  (select count(*) from tenants where deleted_at is null) as tenants_count,
  (select count(*) from leases where deleted_at is null and status = 'active') as active_leases_count,
  (select count(*) from leases where deleted_at is null and status = 'draft') as draft_leases_count,
  (select coalesce(sum(amount_due), 0) from rent_dues
    where deleted_at is null and status <> 'cancelled'
      and date_trunc('month', due_date::timestamptz) = date_trunc('month', current_date::timestamptz)) as month_expected_amount,
  (select coalesce(sum(amount_due), 0) from rent_dues
    where deleted_at is null and status = 'paid'
      and date_trunc('month', due_date::timestamptz) = date_trunc('month', current_date::timestamptz)) as month_paid_amount,
  (select count(*) from rent_dues
    where deleted_at is null and status in ('expected', 'overdue') and due_date < current_date) as overdue_count,
  (select coalesce(sum(amount_due), 0) from rent_dues
    where deleted_at is null and status in ('expected', 'overdue') and due_date < current_date) as overdue_amount;

create or replace view public.ops_landlords_without_active_lease as
select
  l.id as landlord_id,
  concat_ws(' ', l.first_name, l.last_name) as landlord_name,
  l.phone as landlord_phone,
  l.created_at as signed_up_at,
  (current_date - l.created_at::date) as days_since_signup,
  (select count(*) from leases le
    where le.landlord_id = l.id and le.deleted_at is null and le.status = 'draft') as draft_leases_count
from landlords l
where l.deleted_at is null
  and not exists (
    select 1 from leases le
    where le.landlord_id = l.id and le.deleted_at is null and le.status = 'active')
order by l.created_at;

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
from reminder_events re
join landlords l on l.id = re.landlord_id
join tenants t on t.id = re.tenant_id
join rent_dues rd on rd.id = re.rent_due_id
join units u on u.id = rd.unit_id
left join properties p on p.id = u.property_id;

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
  from rent_dues rd
  join leases lease on lease.id = rd.lease_id
  join landlords l on l.id = rd.landlord_id
  join units u on u.id = rd.unit_id
  left join properties p on p.id = u.property_id
  join tenants t on t.id = rd.tenant_id
  left join lateral (
    select max(re.sent_at) as last_reminder_sent_at
    from reminder_events re
    where re.rent_due_id = rd.id and re.tenant_id = rd.tenant_id
  ) last_event on true
  where lease.status = 'active'
    and lease.deleted_at is null
    and rd.deleted_at is null
    and rd.status in ('expected', 'overdue')
    and rd.due_date = any (array[current_date + 5, current_date + 1, current_date - 1, current_date - 3])
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
      'Bonjour ' || tenant_name || ', petit rappel concernant votre loyer. L''échéance est prévue le ' || due_date::text || '. Merci de procéder au paiement ou d''envoyer la preuve si cela a déjà été fait.'
    else
      'Bonjour ' || tenant_name || ', sauf erreur, le loyer prévu le ' || due_date::text || ' n''apparaît pas encore comme payé dans le registre. Merci de régulariser ou d''envoyer la preuve de paiement si cela a déjà été fait.'
  end as suggested_message
from candidates c
where reminder_type is not null
  and not exists (
    select 1 from reminder_events re
    where re.rent_due_id = c.rent_due_id
      and re.tenant_id = c.tenant_id
      and re.reminder_type = c.reminder_type);

-- Vues réservées à l'opérateur : jamais exposées aux rôles API.
revoke all on public.ops_portfolio_stats from anon, authenticated;
revoke all on public.ops_landlords_without_active_lease from anon, authenticated;
revoke all on public.ops_reminder_history from anon, authenticated;
revoke all on public.ops_reminder_queue from anon, authenticated;
