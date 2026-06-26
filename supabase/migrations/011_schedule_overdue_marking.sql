-- Ranti: schedule daily overdue marking
-- Target: PostgreSQL 17 / Supabase
-- Scope: pg_cron job that keeps rent_dues statuses accurate over time
--
-- Without a scheduled job, a due generated as `expected` would never flip to
-- `overdue` once its date passes. A daily job calls mark_all_overdue_rent_dues()
-- so "qui est en retard" stays correct without any UI dependency.

create extension if not exists pg_cron;

-- cron.schedule upserts by job name, so re-running this migration is safe.
select cron.schedule(
  'mark-overdue-daily',
  '5 0 * * *',
  $$select public.mark_all_overdue_rent_dues();$$
);
