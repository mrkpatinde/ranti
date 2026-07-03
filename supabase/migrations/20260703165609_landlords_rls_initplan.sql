-- Perf RLS (advisor auth_rls_initplan) : envelopper auth.uid() dans un
-- sous-select pour qu'il soit évalué une fois par requête, pas par ligne.
-- Comportement identique, plan de requête meilleur à l'échelle.

drop policy if exists landlords_select_own on public.landlords;
create policy landlords_select_own on public.landlords
  for select
  using (auth_user_id = (select auth.uid()) and deleted_at is null);

drop policy if exists landlords_update_own on public.landlords;
create policy landlords_update_own on public.landlords
  for update
  using (auth_user_id = (select auth.uid()) and deleted_at is null)
  with check (auth_user_id = (select auth.uid()));
