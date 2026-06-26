-- Ranti security hardening + missing FK indexes
-- Target: PostgreSQL 17 / Supabase
-- Scope: harden trigger function and add missing FK indexes

-- -----------------------------------------------------------------------------
-- Harden trigger function search_path
-- -----------------------------------------------------------------------------

alter function public.set_updated_at() set search_path = '';

-- -----------------------------------------------------------------------------
-- Ensure audit logs are not writable by client roles
-- -----------------------------------------------------------------------------

revoke insert, update, delete on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Missing FK indexes flagged by Supabase advisor
-- -----------------------------------------------------------------------------

create index if not exists audit_logs_actor_landlord_id_idx
  on public.audit_logs(actor_landlord_id);

create index if not exists rent_dues_tenant_id_idx
  on public.rent_dues(tenant_id);

create index if not exists rent_dues_unit_id_idx
  on public.rent_dues(unit_id);
