-- ADR-004 — Règle de génération des échéances + invariants durs.
-- 1. generate_rent_dues borné par lease.end_date (cas 4).
-- 2. CHECK due_date dans [period_start, period_end].
-- 3. Trigger cross-table : period_start >= mois(lease.start_date).
-- 4. Trigger protection financière ciblée : pas de réécriture/suppression
--    d'une échéance déjà liée à un paiement (champs financiers + delete).

-- ---------------------------------------------------------------------------
-- 1. generate_rent_dues : borne haute = least(mois(today), mois(end_date))
-- ---------------------------------------------------------------------------
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

  -- Cas 2 : début après le jour d'échéance -> première échéance le mois suivant.
  if extract(day from rec.start_date)::int > rec.due_day then
    first_period_month := (first_period_month + interval '1 month')::date;
  end if;

  -- Génère jusqu'au mois courant (échéances à venir incluses si le bail
  -- commence dans le futur), borné par la fin de bail (cas 4).
  last_period_month := greatest(
    first_period_month,
    date_trunc('month', current_date::timestamp)::date
  );

  if rec.end_date is not null then
    last_period_month := least(
      last_period_month,
      date_trunc('month', rec.end_date::timestamp)::date
    );
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

-- ---------------------------------------------------------------------------
-- 2. CHECK : due_date toujours dans le mois couvert par period_start.
--    (due_date peut dépasser lease.end_date, mais jamais le mois de period.)
-- ---------------------------------------------------------------------------
alter table public.rent_dues
  drop constraint if exists rent_dues_due_date_in_period;
alter table public.rent_dues
  add constraint rent_dues_due_date_in_period
  check (due_date >= period_start and due_date <= period_end);

-- ---------------------------------------------------------------------------
-- 3. Invariant cross-table : period_start >= mois(lease.start_date).
--    Échéance jamais avant le début du bail (cas non couvrable par un CHECK).
-- ---------------------------------------------------------------------------
create or replace function private.enforce_rent_due_after_lease_start()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  l_start date;
begin
  select start_date into l_start
  from public.leases
  where id = new.lease_id;

  if l_start is null then
    raise exception 'lease_not_found' using errcode = 'P0002';
  end if;

  if new.period_start < date_trunc('month', l_start::timestamp)::date then
    raise exception 'rent_due_before_lease_start'
      using errcode = 'P0001',
            hint = 'period_start must not precede the lease start month';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_rent_due_after_lease_start on public.rent_dues;
create trigger trg_rent_due_after_lease_start
  before insert or update of period_start, lease_id on public.rent_dues
  for each row execute function private.enforce_rent_due_after_lease_start();

-- ---------------------------------------------------------------------------
-- 4. Protection financière ciblée : on ne réécrit pas une échéance déjà
--    liée à un paiement. Bloque update des champs financiers + delete.
--    N'impacte PAS updated_at, status, notes (non destructifs).
-- ---------------------------------------------------------------------------
create or replace function private.protect_allocated_rent_due()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.rent_reception_allocations where rent_due_id = old.id
    ) then
      raise exception 'rent_due_has_allocations'
        using errcode = 'P0001',
              hint = 'cannot delete a rent due linked to a payment; add a corrective event instead';
    end if;
    return old;
  end if;

  -- UPDATE : seuls les champs financiers sont protégés.
  if (
        new.lease_id     is distinct from old.lease_id
     or new.period_start is distinct from old.period_start
     or new.period_end   is distinct from old.period_end
     or new.due_date     is distinct from old.due_date
     or new.amount_due   is distinct from old.amount_due
     or new.currency     is distinct from old.currency
  ) and exists (
        select 1 from public.rent_reception_allocations where rent_due_id = old.id
  ) then
    raise exception 'rent_due_financial_locked'
      using errcode = 'P0001',
            hint = 'financial fields of an allocated rent due cannot be changed';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_allocated_rent_due on public.rent_dues;
create trigger trg_protect_allocated_rent_due
  before update or delete on public.rent_dues
  for each row execute function private.protect_allocated_rent_due();
