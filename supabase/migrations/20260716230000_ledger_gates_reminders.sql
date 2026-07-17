-- ADR-023 (bascule des relances) — la file opérateur lit le compte courant.
--
-- Résout la limite documentée de la coexistence des lentilles : un crédit
-- affecté par le bailleur à un mois futur alors qu'un mois ancien restait dû
-- produisait une relance de RETARD pour un locataire à jour au compte courant
-- (le grand livre nette les avances ; la file par échéance ne nettait pas).
--
-- Règle : les relances de retard (late_j_1, late_j_3) ne sortent que si le
-- BAIL porte un impayé au grand livre (lease_balances.overdue_amount > 0).
-- Les rappels pré-échéance (j_5, j_1) sont inchangés — annoncer une échéance
-- à venir reste juste même quand le compte est à zéro.
--
-- Base : définition 20260705175213 (fenêtres glissantes + dédup 7 jours,
-- identique au live — vérifié via pg_get_viewdef le 2026-07-16). Le contrat
-- ranti-ops (ADR-022) est inchangé par ailleurs ; une colonne
-- ledger_overdue_amount est AJOUTÉE en fin (create or replace l'autorise,
-- les consommateurs existants ne voient rien changer).
--
-- La projection UI (lib/reminders/schedule.ts) applique la même règle dans le
-- même commit : l'écran promet exactement ce que la file contient (ADR-022 —
-- l'UI ne promet que ce qui est vrai).

begin;

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
    last_event.last_reminder_sent_at,
    coalesce(lb.overdue_amount, 0) as ledger_overdue_amount
  from public.rent_dues rd
  join public.leases lease on lease.id = rd.lease_id
  join public.landlords l on l.id = rd.landlord_id
  join public.units u on u.id = rd.unit_id
  left join public.properties p on p.id = u.property_id
  join public.tenants t on t.id = rd.tenant_id
  left join public.lease_balances lb on lb.lease_id = rd.lease_id
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
  confirmation_token,
  ledger_overdue_amount
from candidates c
where reminder_type is not null
  -- Garde compte courant (ADR-023) : pas de relance de RETARD pour un bail
  -- sans impayé au grand livre — une avance nette la dette, quel que soit le
  -- mois auquel le bailleur l'a affectée.
  and (reminder_type in ('j_5', 'j_1') or ledger_overdue_amount > 0)
  and not exists (
    select 1
    from public.reminder_events re
    where re.rent_due_id = c.rent_due_id
      and re.tenant_id = c.tenant_id
      and re.reminder_type = c.reminder_type
      and re.sent_at > now() - interval '7 days'
  );

revoke all on table public.ops_reminder_queue from anon, authenticated;

commit;
