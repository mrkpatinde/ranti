-- Ranti: rent dues generation from a lease
-- Target: PostgreSQL 17 / Supabase
-- Scope: generate monthly rent_dues from a lease; activate a lease atomically
--
-- domain 002 / api.md (Rent Schedules): a rent due is born from the lease. The
-- lease is the source of the generation rule (amount, due_day, period). Generation
-- is idempotent (unique (lease_id, period_start)) and transactional.
--
-- Both functions run as SECURITY INVOKER, so RLS applies: a landlord can only
-- read/write their own rows, and the rent_dues insert check
-- (landlord_id = private.current_landlord_id()) is satisfied from the lease.

-- -----------------------------------------------------------------------------
-- generate_rent_dues: create the monthly dues for one lease, from the lease
-- start month through the current month (or just the start month if it is in the
-- future). Idempotent. Returns the number of dues created.
-- -----------------------------------------------------------------------------
create or replace function public.generate_rent_dues(p_lease_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rec public.leases;
  created integer;
begin
  select * into rec
  from public.leases
  where id = p_lease_id
    and landlord_id = private.current_landlord_id()
    and deleted_at is null;

  if not found then
    raise exception 'lease_not_found' using errcode = 'P0002';
  end if;

  insert into public.rent_dues (
    landlord_id, lease_id, unit_id, tenant_id,
    period_start, period_end, due_date, amount_due, currency, status
  )
  select
    g.landlord_id, g.lease_id, g.unit_id, g.tenant_id,
    g.period_start, g.period_end, g.due_date, g.amount_due, g.currency,
    case when g.due_date < current_date then 'overdue' else 'expected' end
  from (
    select
      rec.landlord_id as landlord_id,
      rec.id as lease_id,
      rec.unit_id as unit_id,
      rec.tenant_id as tenant_id,
      rec.monthly_rent_amount as amount_due,
      rec.currency as currency,
      m::date as period_start,
      (m + interval '1 month' - interval '1 day')::date as period_end,
      (
        m
        + (
            least(
              rec.due_day,
              extract(day from (m + interval '1 month' - interval '1 day'))::int
            ) - 1
          ) * interval '1 day'
      )::date as due_date
    from generate_series(
      date_trunc('month', rec.start_date::timestamp),
      date_trunc('month', greatest(rec.start_date, current_date)::timestamp),
      interval '1 month'
    ) as m
  ) g
  on conflict (lease_id, period_start) do nothing;

  get diagnostics created = row_count;
  return created;
end;
$$;

revoke all on function public.generate_rent_dues(uuid) from public, anon;
grant execute on function public.generate_rent_dues(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- activate_lease: draft -> active (enforces the no-overlap exclusion) and then
-- generates the rent dues, atomically in one transaction.
-- -----------------------------------------------------------------------------
create or replace function public.activate_lease(p_lease_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rec public.leases;
begin
  select * into rec
  from public.leases
  where id = p_lease_id
    and landlord_id = private.current_landlord_id()
    and deleted_at is null;

  if not found then
    raise exception 'lease_not_found' using errcode = 'P0002';
  end if;

  if rec.status <> 'draft' then
    raise exception 'lease_not_draft' using errcode = 'P0001';
  end if;

  -- May raise 23P01 (exclusion_violation) if the unit already has an active lease
  -- overlapping this period.
  update public.leases set status = 'active' where id = p_lease_id;

  perform public.generate_rent_dues(p_lease_id);
end;
$$;

revoke all on function public.activate_lease(uuid) from public, anon;
grant execute on function public.activate_lease(uuid) to authenticated;
