-- Ranti initial schema
-- Target: PostgreSQL 17 / Supabase
-- Scope: MVP business tables only

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Landlords
-- -----------------------------------------------------------------------------

create table public.landlords (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  phone text not null unique,
  first_name text not null,
  last_name text not null,
  civility text check (civility in ('mr', 'mrs', 'miss', 'not_specified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger landlords_set_updated_at
before update on public.landlords
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Properties
-- A property is a physical place owned or managed by a landlord.
-- -----------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  name text not null,
  city text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index properties_landlord_id_idx on public.properties(landlord_id);

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Units
-- A unit is the rentable space inside a property.
-- Availability is kept simple for the MVP: available or occupied.
-- -----------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  unit_type text not null check (unit_type in ('house', 'apartment', 'room', 'shop', 'store', 'office', 'warehouse', 'other')),
  availability_status text not null default 'available' check (availability_status in ('available', 'occupied')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (property_id, name)
);

create index units_landlord_id_idx on public.units(landlord_id);
create index units_property_id_idx on public.units(property_id);

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tenants
-- A tenant belongs to a landlord's local Ranti space.
-- The same real person can exist in another landlord's space independently.
-- -----------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tenants_landlord_id_idx on public.tenants(landlord_id);
create index tenants_phone_idx on public.tenants(phone) where phone is not null;

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Leases
-- A lease is the rental agreement. It generates rent dues.
-- A unit must not have overlapping active leases.
-- -----------------------------------------------------------------------------

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  monthly_rent_amount integer not null check (monthly_rent_amount > 0),
  currency text not null default 'XOF',
  due_day integer not null check (due_day between 1 and 31),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  contract_storage_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date is null or end_date >= start_date)
);

create index leases_landlord_id_idx on public.leases(landlord_id);
create index leases_unit_id_idx on public.leases(unit_id);
create index leases_tenant_id_idx on public.leases(tenant_id);

alter table public.leases
add constraint leases_no_overlapping_active_unit_periods
exclude using gist (
  unit_id with =,
  daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
)
where (status = 'active' and deleted_at is null);

create trigger leases_set_updated_at
before update on public.leases
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rent dues
-- A rent due is the central MVP object: a rent obligation for one period.
-- Visible statuses stay simple. Partial payment is computed via allocations.
-- -----------------------------------------------------------------------------

create table public.rent_dues (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount_due integer not null check (amount_due > 0),
  currency text not null default 'XOF',
  status text not null default 'expected' check (status in ('expected', 'overdue', 'paid', 'cancelled')),
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (lease_id, period_start),
  check (period_end >= period_start)
);

create index rent_dues_landlord_id_idx on public.rent_dues(landlord_id);
create index rent_dues_lease_id_idx on public.rent_dues(lease_id);
create index rent_dues_status_idx on public.rent_dues(status);
create index rent_dues_due_date_idx on public.rent_dues(due_date);

create trigger rent_dues_set_updated_at
before update on public.rent_dues
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rent receptions
-- A rent reception records that the landlord received rent money.
-- Proof is useful but optional in the MVP.
-- -----------------------------------------------------------------------------

create table public.rent_receptions (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  received_at timestamptz not null default now(),
  amount_received integer not null check (amount_received > 0),
  currency text not null default 'XOF',
  payment_method text not null check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'other')),
  status text not null default 'confirmed' check (status in ('draft', 'confirmed', 'cancelled')),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status <> 'confirmed') or confirmed_at is not null),
  check ((status <> 'cancelled') or cancelled_at is not null)
);

create index rent_receptions_landlord_id_idx on public.rent_receptions(landlord_id);
create index rent_receptions_tenant_id_idx on public.rent_receptions(tenant_id);
create index rent_receptions_unit_id_idx on public.rent_receptions(unit_id);
create index rent_receptions_received_at_idx on public.rent_receptions(received_at);
create index rent_receptions_status_idx on public.rent_receptions(status);

create trigger rent_receptions_set_updated_at
before update on public.rent_receptions
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rent reception allocations
-- This table allows one rent reception to cover several dues, and one due to
-- receive several partial receptions.
-- -----------------------------------------------------------------------------

create table public.rent_reception_allocations (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  rent_reception_id uuid not null references public.rent_receptions(id) on delete cascade,
  rent_due_id uuid not null references public.rent_dues(id) on delete restrict,
  amount_allocated integer not null check (amount_allocated > 0),
  created_at timestamptz not null default now(),
  unique (rent_reception_id, rent_due_id)
);

create index rent_reception_allocations_landlord_id_idx on public.rent_reception_allocations(landlord_id);
create index rent_reception_allocations_reception_id_idx on public.rent_reception_allocations(rent_reception_id);
create index rent_reception_allocations_due_id_idx on public.rent_reception_allocations(rent_due_id);

-- -----------------------------------------------------------------------------
-- Payment proofs
-- Proofs are linked first to a rent reception. A direct due link is allowed only
-- as extra context and should remain exceptional.
-- -----------------------------------------------------------------------------

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  rent_reception_id uuid not null references public.rent_receptions(id) on delete cascade,
  rent_due_id uuid references public.rent_dues(id) on delete set null,
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index payment_proofs_landlord_id_idx on public.payment_proofs(landlord_id);
create index payment_proofs_reception_id_idx on public.payment_proofs(rent_reception_id);
create index payment_proofs_due_id_idx on public.payment_proofs(rent_due_id) where rent_due_id is not null;

-- -----------------------------------------------------------------------------
-- Receipts
-- A receipt can only be generated after a confirmed rent reception.
-- -----------------------------------------------------------------------------

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  rent_reception_id uuid not null unique references public.rent_receptions(id) on delete restrict,
  receipt_number text not null,
  issued_at timestamptz not null default now(),
  total_amount integer not null check (total_amount > 0),
  currency text not null default 'XOF',
  status text not null default 'issued' check (status in ('issued', 'cancelled')),
  pdf_storage_path text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (landlord_id, receipt_number),
  check ((status <> 'cancelled') or cancelled_at is not null)
);

create index receipts_landlord_id_idx on public.receipts(landlord_id);
create index receipts_reception_id_idx on public.receipts(rent_reception_id);

create trigger receipts_set_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit logs
-- Append-only record of sensitive actions.
-- -----------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid references public.landlords(id) on delete set null,
  actor_landlord_id uuid references public.landlords(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_landlord_id_idx on public.audit_logs(landlord_id);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at);

-- -----------------------------------------------------------------------------
-- Notes
-- -----------------------------------------------------------------------------
-- RLS policies are intentionally not included in this first migration.
-- They will be added in a dedicated security migration after schema validation.
