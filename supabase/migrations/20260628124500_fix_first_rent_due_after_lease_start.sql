create or replace function public.generate_rent_dues(p_lease_id uuid)
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  rec public.leases;
  created integer;
  first_period_month date;
  last_period_month date;
begin
  select * into rec
  from public.leases
  where id = p_lease_id
    and landlord_id = private.current_landlord_id()
    and deleted_at is null;

  if not found then
    raise exception 'lease_not_found' using errcode = 'P0002';
  end if;

  first_period_month := date_trunc('month', rec.start_date::timestamp)::date;

  if extract(day from rec.start_date)::int > rec.due_day then
    first_period_month := (first_period_month + interval '1 month')::date;
  end if;

  last_period_month := date_trunc(
    'month',
    greatest(first_period_month, current_date)::timestamp
  )::date;

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
      first_period_month,
      last_period_month,
      interval '1 month'
    ) as m
  ) g
  on conflict (lease_id, period_start) do nothing;

  get diagnostics created = row_count;
  return created;
end;
$function$;
