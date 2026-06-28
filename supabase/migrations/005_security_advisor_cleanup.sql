-- Ranti security advisor cleanup
-- Target: PostgreSQL 17 / Supabase
-- Scope: remove remaining exposed SECURITY DEFINER warnings and move btree_gist out of public.

-- -----------------------------------------------------------------------------
-- Move extensions away from the exposed public schema
-- -----------------------------------------------------------------------------

create schema if not exists extensions;
alter extension btree_gist set schema extensions;

-- -----------------------------------------------------------------------------
-- Keep RLS helper out of the exposed public API schema
-- -----------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_landlord_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.landlords
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1
$$;

revoke all on function private.current_landlord_id() from public;
grant execute on function private.current_landlord_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Repoint RLS policies to the private helper
-- -----------------------------------------------------------------------------

alter policy "audit_logs_select_own"
on public.audit_logs
using (
  landlord_id = private.current_landlord_id()
  or actor_landlord_id = private.current_landlord_id()
);

alter policy "properties_select_own"
on public.properties
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "properties_insert_own"
on public.properties
with check (landlord_id = private.current_landlord_id());

alter policy "properties_update_own"
on public.properties
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "units_select_own"
on public.units
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "units_insert_own"
on public.units
with check (landlord_id = private.current_landlord_id());

alter policy "units_update_own"
on public.units
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "tenants_select_own"
on public.tenants
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "tenants_insert_own"
on public.tenants
with check (landlord_id = private.current_landlord_id());

alter policy "tenants_update_own"
on public.tenants
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "leases_select_own"
on public.leases
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "leases_insert_own"
on public.leases
with check (landlord_id = private.current_landlord_id());

alter policy "leases_update_own"
on public.leases
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "rent_dues_select_own"
on public.rent_dues
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "rent_dues_insert_own"
on public.rent_dues
with check (landlord_id = private.current_landlord_id());

alter policy "rent_dues_update_own"
on public.rent_dues
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "rent_receptions_select_own"
on public.rent_receptions
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "rent_receptions_insert_own"
on public.rent_receptions
with check (landlord_id = private.current_landlord_id());

alter policy "rent_receptions_update_own"
on public.rent_receptions
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "rent_reception_allocations_select_own"
on public.rent_reception_allocations
using (landlord_id = private.current_landlord_id());

alter policy "rent_reception_allocations_insert_own"
on public.rent_reception_allocations
with check (landlord_id = private.current_landlord_id());

alter policy "rent_reception_allocations_update_own"
on public.rent_reception_allocations
using (landlord_id = private.current_landlord_id())
with check (landlord_id = private.current_landlord_id());

alter policy "payment_proofs_select_own"
on public.payment_proofs
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "payment_proofs_insert_own"
on public.payment_proofs
with check (landlord_id = private.current_landlord_id());

alter policy "payment_proofs_update_own"
on public.payment_proofs
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

alter policy "receipts_select_own"
on public.receipts
using (landlord_id = private.current_landlord_id() and deleted_at is null);

alter policy "receipts_insert_own"
on public.receipts
with check (landlord_id = private.current_landlord_id());

alter policy "receipts_update_own"
on public.receipts
using (landlord_id = private.current_landlord_id() and deleted_at is null)
with check (landlord_id = private.current_landlord_id());

-- -----------------------------------------------------------------------------
-- Public SECURITY DEFINER helpers must not be callable through PostgREST RPC
-- -----------------------------------------------------------------------------

revoke all on function public.current_landlord_id() from public, anon, authenticated;

-- Guard: rls_auto_enable() n'est créée par aucune migration (existe seulement
-- en live, hors-ledger). Le revoke inconditionnel cassait le fresh-apply.
-- Idempotent, sans effet métier, non rejoué en live.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
