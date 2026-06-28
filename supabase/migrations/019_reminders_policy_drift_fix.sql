-- ============================================================
-- Migration 019 : Reminders RLS policy drift fix
-- ============================================================
-- Live drift detected (read-only audit): the reminders SELECT policy on the
-- live DB used `current_setting('app.current_landlord_id')::uuid` — a GUC that
-- is never set anywhere (no function/request sets it), and a different
-- multi-tenant model from every other business table. Migration 018 on main
-- already declares the correct policy with `private.current_landlord_id()`,
-- but the live policy was applied from an older variant and never updated.
--
-- This forward migration re-asserts the correct policy so live matches main
-- and the multi-tenant model is uniform. Idempotent.

drop policy if exists "Landlords see own reminders" on public.reminders;

create policy "Landlords see own reminders" on public.reminders
  for select
  to authenticated
  using (landlord_id = private.current_landlord_id());
