-- ============================================================
-- 20260809120100 — Retrait des charges variables et des RPC mortes
-- ============================================================
-- ADR-026 a retiré les charges variables du périmètre produit ; le SQL est
-- resté (8 fonctions SECURITY DEFINER, une table de notification, 4 RPC
-- exposées à anon). Cette migration supprime la surface correspondante.
--
-- Sont également retirées les fonctions sans aucun appelant applicatif :
-- vérifié par balayage de apps/web/src (0 occurrence pour chacune).
-- Le grand livre public.transactions est conservé : il porte le solde par
-- bail affiché au tableau de bord.
-- ============================================================

begin;

-- 1. Charges variables (ADR-026) — écrans supprimés, SQL resté exposé.
drop function if exists public.add_lease_charge(uuid, text, integer, text, date, uuid);
drop function if exists public.replace_ledger_charge(uuid, integer, text, date, text);
drop function if exists public.withdraw_ledger_line(uuid, text);
drop function if exists public.get_ledger_line_by_token(uuid);
drop function if exists public.validate_ledger_line_by_token(uuid);
drop function if exists public.contest_ledger_line_by_token(uuid, text, integer, text);
drop function if exists public.retract_contest_by_token(uuid);
drop function if exists public.schedule_charge_reminder(uuid, date, text);

-- 2. Parcours locataire abandonné : déclaration de paiement par jeton
--    d'échéance. Remplacé par le parcours quittance (/recu/[token]).
drop function if exists public.get_rent_due_by_token(uuid);
drop function if exists public.declare_rent_payment_by_token(uuid, text, text);

-- 3. Chemin d'entrée « opérateur » : jamais câblé côté produit.
drop function if exists public.ops_record_collection(uuid, integer, text, timestamptz, text, text, uuid);
drop function if exists public.ops_confirm_collection(uuid, text);
drop function if exists public.mark_all_overdue_rent_dues();
drop function if exists public.update_landlord_identity(text, text, text, text);

-- Balayage de sécurité : surcharges résiduelles de ces mêmes noms.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proname in (
        'add_lease_charge', 'replace_ledger_charge', 'withdraw_ledger_line',
        'get_ledger_line_by_token', 'validate_ledger_line_by_token',
        'contest_ledger_line_by_token', 'retract_contest_by_token',
        'schedule_charge_reminder', 'get_rent_due_by_token',
        'declare_rent_payment_by_token', 'ops_record_collection',
        'ops_confirm_collection', 'mark_all_overdue_rent_dues',
        'update_landlord_identity'
      )
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

-- 4. File de notification des charges : sans objet une fois les charges
--    retirées. Les vues ops qui la lisent tombent avec elle (cascade).
drop view if exists public.ops_ledger_notification_queue;
drop view if exists public.ops_ledger_notifications;
drop table if exists public.ledger_notification_events cascade;

-- 5. scheduled_reminders.charge_id devient sans référent. La vue ops qui
--    l'unionnait est reconstruite sur la seule branche loyer.
drop view if exists public.ops_scheduled_reminders;
alter table public.scheduled_reminders drop column if exists charge_id;

create view public.ops_scheduled_reminders as
select
  sr.id,
  sr.scheduled_for,
  sr.channel,
  sr.created_at,
  'loyer'::text as kind,
  not exists (
    select 1 from public.reminders rm
    join public.rent_dues rd2 on rd2.id = rm.rent_due_id
    where rd2.tenant_id = rd.tenant_id
  ) and not exists (
    select 1 from public.reminder_events ev where ev.tenant_id = rd.tenant_id
  ) as first_contact,
  l.phone           as landlord_phone,
  concat_ws(' ', l.first_name, l.last_name) as landlord_name,
  t.phone           as tenant_phone,
  concat_ws(' ', t.first_name, t.last_name) as tenant_name,
  u.name            as unit_name,
  rd.due_date,
  greatest(0::bigint, rd.amount_due - coalesce(paid.total, 0)) as amount_remaining
from public.scheduled_reminders sr
join public.rent_dues rd on rd.id = sr.rent_due_id
join public.landlords l  on l.id  = sr.landlord_id
join public.tenants   t  on t.id  = rd.tenant_id
join public.units     u  on u.id  = rd.unit_id
left join lateral (
  select sum(a.amount_allocated) as total
  from public.rent_reception_allocations a
  join public.rent_receptions r on r.id = a.rent_reception_id
  where a.rent_due_id = rd.id and r.status = 'confirmed' and r.deleted_at is null
) paid on true
where sr.status = 'pending'
  and sr.scheduled_for <= current_date
  and sr.rent_due_id is not null;

revoke all on public.ops_scheduled_reminders from anon, authenticated;
grant select on public.ops_scheduled_reminders to service_role;

commit;
