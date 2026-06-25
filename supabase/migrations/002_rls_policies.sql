-- Ranti initial RLS policies
-- Target: PostgreSQL 17 / Supabase
-- Scope: MVP tables only

-- -----------------------------------------------------------------------------
-- Helper: current landlord id
-- -----------------------------------------------------------------------------

create or replace function public.current_landlord_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.landlords
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1
$$;

revoke all on function public.current_landlord_id() from public;
grant execute on function public.current_landlord_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------

alter table public.landlords enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_dues enable row level security;
alter table public.rent_receptions enable row level security;
alter table public.rent_reception_allocations enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.receipts enable row level security;
alter table public.audit_logs enable row level security;

-- -----------------------------------------------------------------------------
-- Landlords
-- A landlord can read and update only their own profile.
-- Creation happens through trusted onboarding/server code.
-- -----------------------------------------------------------------------------

create policy "landlords_select_own"
on public.landlords
for select
to authenticated
using (auth_user_id = auth.uid() and deleted_at is null);

create policy "landlords_update_own"
on public.landlords
for update
to authenticated
using (auth_user_id = auth.uid() and deleted_at is null)
with check (auth_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Standard landlord-owned tables
-- -----------------------------------------------------------------------------

create policy "properties_select_own"
on public.properties
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "properties_insert_own"
on public.properties
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "properties_update_own"
on public.properties
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "units_select_own"
on public.units
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "units_insert_own"
on public.units
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "units_update_own"
on public.units
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "tenants_select_own"
on public.tenants
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "tenants_insert_own"
on public.tenants
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "tenants_update_own"
on public.tenants
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "leases_select_own"
on public.leases
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "leases_insert_own"
on public.leases
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "leases_update_own"
on public.leases
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "rent_dues_select_own"
on public.rent_dues
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "rent_dues_insert_own"
on public.rent_dues
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "rent_dues_update_own"
on public.rent_dues
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "rent_receptions_select_own"
on public.rent_receptions
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "rent_receptions_insert_own"
on public.rent_receptions
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "rent_receptions_update_own"
on public.rent_receptions
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "rent_reception_allocations_select_own"
on public.rent_reception_allocations
for select
to authenticated
using (landlord_id = public.current_landlord_id());

create policy "rent_reception_allocations_insert_own"
on public.rent_reception_allocations
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "rent_reception_allocations_update_own"
on public.rent_reception_allocations
for update
to authenticated
using (landlord_id = public.current_landlord_id())
with check (landlord_id = public.current_landlord_id());

create policy "payment_proofs_select_own"
on public.payment_proofs
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "payment_proofs_insert_own"
on public.payment_proofs
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "payment_proofs_update_own"
on public.payment_proofs
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

create policy "receipts_select_own"
on public.receipts
for select
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null);

create policy "receipts_insert_own"
on public.receipts
for insert
to authenticated
with check (landlord_id = public.current_landlord_id());

create policy "receipts_update_own"
on public.receipts
for update
to authenticated
using (landlord_id = public.current_landlord_id() and deleted_at is null)
with check (landlord_id = public.current_landlord_id());

-- -----------------------------------------------------------------------------
-- Audit logs
-- Authenticated landlords can read their own audit trail.
-- Inserts are allowed only for their own landlord_id. In production, sensitive
-- audit writes should preferably be performed by trusted server code.
-- No update/delete policy is created: audit logs are append-only.
-- -----------------------------------------------------------------------------

create policy "audit_logs_select_own"
on public.audit_logs
for select
to authenticated
using (landlord_id = public.current_landlord_id());

create policy "audit_logs_insert_own"
on public.audit_logs
for insert
to authenticated
with check (
  landlord_id = public.current_landlord_id()
  and (actor_landlord_id is null or actor_landlord_id = public.current_landlord_id())
);
