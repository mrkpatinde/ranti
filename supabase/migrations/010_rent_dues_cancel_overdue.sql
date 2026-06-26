-- Ranti: cancel a rent due + mark overdue dues
-- Target: PostgreSQL 17 / Supabase
-- Scope: rent_dues lifecycle (cancel with trace, overdue transition)
-- api.md (Rent Schedules): cancel never physically deletes; it is refused when a
-- confirmed reception is allocated to the due. Overdue is a status reached when
-- the due date passes without payment.

-- -----------------------------------------------------------------------------
-- cancel_rent_due: mark a due cancelled (with reason). Idempotent. Refused if a
-- confirmed reception is allocated to it (would make the memory inconsistent).
-- -----------------------------------------------------------------------------
create or replace function public.cancel_rent_due(p_rent_due_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rec public.rent_dues;
begin
  select * into rec
  from public.rent_dues
  where id = p_rent_due_id
    and landlord_id = private.current_landlord_id()
    and deleted_at is null;

  if not found then
    raise exception 'rent_due_not_found' using errcode = 'P0002';
  end if;

  if rec.status = 'cancelled' then
    return;
  end if;

  if rec.status = 'paid' then
    raise exception 'rent_due_paid' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.rent_reception_allocations a
    join public.rent_receptions r on r.id = a.rent_reception_id
    where a.rent_due_id = p_rent_due_id
      and r.status = 'confirmed'
  ) then
    raise exception 'rent_due_has_confirmed_allocations' using errcode = 'P0001';
  end if;

  update public.rent_dues
  set status = 'cancelled', cancelled_reason = p_reason
  where id = p_rent_due_id;
end;
$$;

revoke all on function public.cancel_rent_due(uuid, text) from public, anon;
grant execute on function public.cancel_rent_due(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- mark_all_overdue_rent_dues: flip expected -> overdue for every landlord once
-- the due date has passed. SECURITY DEFINER, intended to run from a scheduled
-- job (see migration 011). Not callable by client roles.
-- -----------------------------------------------------------------------------
create or replace function public.mark_all_overdue_rent_dues()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.rent_dues
  set status = 'overdue'
  where deleted_at is null
    and status = 'expected'
    and due_date < current_date;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_all_overdue_rent_dues() from public, anon, authenticated;
