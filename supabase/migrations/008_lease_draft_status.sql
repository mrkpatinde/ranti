-- Ranti: add a `draft` status to leases
-- Target: PostgreSQL 17 / Supabase
-- Scope: leases.status lifecycle
--
-- api.md (Leases) models create -> activate -> end as distinct steps: a lease is
-- first created ("prêt à activer"), then activated (which checks unit/period
-- overlap and generates the rent dues). The initial schema only had
-- active|ended|cancelled, so there was no pre-active state. We add `draft` and
-- make it the default. The no-overlap exclusion constraint only guards
-- status='active', so multiple drafts never conflict — the overlap check fires
-- on activation, exactly where api.md expects it.

alter table public.leases alter column status set default 'draft';

alter table public.leases drop constraint leases_status_check;

alter table public.leases
  add constraint leases_status_check
  check (status in ('draft', 'active', 'ended', 'cancelled'));
