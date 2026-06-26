-- Ranti landlord self-onboarding
-- Target: PostgreSQL 17 / Supabase
-- Scope: allow an authenticated user to create their own landlord profile

-- -----------------------------------------------------------------------------
-- Landlords self-insert
-- The business landlord row is created only after phone verification, from the
-- user's own authenticated session. A user can only create a profile bound to
-- their own auth.uid(). All other creation paths stay closed.
-- -----------------------------------------------------------------------------

create policy "landlords_insert_self"
on public.landlords
for insert
to authenticated
with check (auth_user_id = (select auth.uid()));
