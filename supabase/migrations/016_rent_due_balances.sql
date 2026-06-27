-- Ranti: rent due balances view
-- Target: PostgreSQL 17 / Supabase
-- Exposes amount_paid per due (sum of confirmed allocations) so the app can
-- show the real remaining amount (amount_due - amount_paid). A partial payment
-- keeps the due expected/overdue but must reduce what is still "à encaisser".
-- security_invoker = on so RLS on rent_dues / allocations / receptions applies.

create or replace view public.rent_due_balances
with (security_invoker = on) as
select
  d.*,
  coalesce((
    select sum(a.amount_allocated)
    from public.rent_reception_allocations a
    join public.rent_receptions r on r.id = a.rent_reception_id
    where a.rent_due_id = d.id
      and r.status = 'confirmed'
      and r.deleted_at is null
  ), 0)::integer as amount_paid
from public.rent_dues d;

revoke all on public.rent_due_balances from public, anon;
grant select on public.rent_due_balances to authenticated;
