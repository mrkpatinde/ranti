-- Ranti: allow landlords to archive (soft-delete) and restore their own rows
-- Target: PostgreSQL 17 / Supabase
-- Scope: UPDATE + SELECT RLS policies of the business tables
--
-- -----------------------------------------------------------------------------
-- Root cause
-- -----------------------------------------------------------------------------
-- A landlord could not archive their own row: `update <table> set deleted_at = now()`
-- failed with "new row violates row-level security policy", while a plain
-- `update <table> set <col> = ...` succeeded.
--
-- For an UPDATE, PostgreSQL checks the *resulting* row against the table's SELECT
-- policy (the row must remain visible to its owner). The SELECT policies carried
-- `deleted_at IS NULL`, so writing deleted_at made the new row invisible under
-- SELECT and the whole UPDATE was rejected -- even with no RETURNING clause.
-- The UPDATE policies' USING also carried `deleted_at IS NULL`, which additionally
-- blocked RESTORE, because an already-archived row is not visible to the UPDATE scan.
--
-- -----------------------------------------------------------------------------
-- Fix
-- -----------------------------------------------------------------------------
-- Drop `deleted_at IS NULL` from BOTH the SELECT USING and the UPDATE USING for the
-- eight landlord-owned business tables, keeping the landlord_id match in every clause
-- (USING + WITH CHECK). This lets the owner move deleted_at NULL -> non-NULL (archive,
-- Roadmap Sprint 3/4 + api.md /archive endpoints) and non-NULL -> NULL (restore).
--
-- Landlord isolation is fully preserved:
--   * a landlord still reads and updates only their own rows;
--   * the WITH CHECK forbids reassigning a row to another landlord_id.
-- Archived rows stay hidden from normal listings because the application queries
-- already filter `.is('deleted_at', null)` (see src/lib/**/queries.ts), in line with
-- architecture-principles #12 (logical archive, never a physical delete).
--
-- rent_reception_allocations is intentionally excluded: it has no deleted_at column.

-- properties
alter policy "properties_select_own" on public.properties
  using (landlord_id = private.current_landlord_id());
alter policy "properties_update_own" on public.properties
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- units
alter policy "units_select_own" on public.units
  using (landlord_id = private.current_landlord_id());
alter policy "units_update_own" on public.units
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- tenants
alter policy "tenants_select_own" on public.tenants
  using (landlord_id = private.current_landlord_id());
alter policy "tenants_update_own" on public.tenants
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- leases
alter policy "leases_select_own" on public.leases
  using (landlord_id = private.current_landlord_id());
alter policy "leases_update_own" on public.leases
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- rent_dues
alter policy "rent_dues_select_own" on public.rent_dues
  using (landlord_id = private.current_landlord_id());
alter policy "rent_dues_update_own" on public.rent_dues
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- rent_receptions
alter policy "rent_receptions_select_own" on public.rent_receptions
  using (landlord_id = private.current_landlord_id());
alter policy "rent_receptions_update_own" on public.rent_receptions
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- payment_proofs
alter policy "payment_proofs_select_own" on public.payment_proofs
  using (landlord_id = private.current_landlord_id());
alter policy "payment_proofs_update_own" on public.payment_proofs
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- receipts
alter policy "receipts_select_own" on public.receipts
  using (landlord_id = private.current_landlord_id());
alter policy "receipts_update_own" on public.receipts
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());
