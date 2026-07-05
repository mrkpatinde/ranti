-- ============================================================
-- Fix M4 — relance de retard récurrente (hebdomadaire).
--
-- Problème : ops_reminder_queue dédup sur (rent_due_id, tenant_id,
--   reminder_type) « pour toujours », verrouillé par un UNIQUE. La fenêtre
--   late_j_3 couvre due_date ∈ [−60, −3] (57 jours) : une seule relance
--   « retard » possible sur toute la fenêtre → dès le 1er envoi, l'échéance
--   disparaît de la file opérateur pour ~2 mois. Le mauvais payeur devient
--   invisible.
--
-- Décision (revue 2026-07-05) : cadence hebdomadaire, horizon 60 j conservé.
--
-- Solution : dédup fenêtrée à 7 jours au lieu de « jamais ». Effet par type :
--   - j_5 / j_1 / late_j_1 : fenêtres < 7 j → envoyées une fois (inchangé).
--   - late_j_3 : fenêtre −3..−60 j → réapparaît chaque semaine tant qu'impayé.
-- Le UNIQUE « un par type et pour toujours » est retiré (il bloquait la
-- répétition). Un index unique par jour serait idéal mais timestamptz::date
-- n'est pas IMMUTABLE → non indexable ; le throttle 7 j de la vue suffit
-- (l'opérateur n'est pas re-sollicité avant 7 j). Idempotent.
-- ============================================================

BEGIN;

-- 1. Relâche l'unicité qui bloquait la répétition.
alter table public.reminder_events
  drop constraint if exists reminder_events_rent_due_id_tenant_id_reminder_type_key;

-- 2. Vue : seule la dédup finale change (fenêtre glissante de 7 jours).
create or replace view public.ops_reminder_queue as
with candidates as (
  select
    rd.id as rent_due_id,
    rd.lease_id,
    rd.landlord_id,
    rd.tenant_id,
    rd.confirmation_token,
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
      when rd.due_date between current_date + 2 and current_date + 5 then 'j_5'
      when rd.due_date between current_date and current_date + 1 then 'j_1'
      when rd.due_date between current_date - 2 and current_date - 1 then 'late_j_1'
      when rd.due_date between current_date - 60 and current_date - 3 then 'late_j_3'
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
    and rd.due_date between current_date - 60 and current_date + 5
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
  end as suggested_message,
  confirmation_token
from candidates c
where reminder_type is not null
  and not exists (
    select 1
    from public.reminder_events re
    where re.rent_due_id = c.rent_due_id
      and re.tenant_id = c.tenant_id
      and re.reminder_type = c.reminder_type
      and re.sent_at > now() - interval '7 days'
  );

revoke all on table public.ops_reminder_queue from anon, authenticated;

COMMIT;
