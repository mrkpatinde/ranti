-- ============================================================
-- 20260809120700 — Relevé mensuel du propriétaire mandant (brique 3)
-- ============================================================
-- Le produit vendu à l'agence n'est pas l'encaissement — elle sait encaisser.
-- C'est la clôture du mois : justifier à chaque mandant ce qui a été encaissé,
-- ce qui a été retenu en honoraires, et ce qui lui est reversé. Trois à cinq
-- jours par mois passés sur Excel et WhatsApp chez un administrateur de biens.
--
-- Règle de calcul, volontairement unique :
--   encaissé   = somme des allocations sur des encaissements CONFIRMÉS dont
--                la date de réception tombe dans le mois
--   honoraires = floor(encaissé × fee_rate_bp / 10000), calculé PAR LIGNE
--   net        = encaissé − honoraires
--
-- Les honoraires sont arrondis à l'entier inférieur ligne par ligne, et le
-- total est la somme des lignes. Le relevé s'additionne donc à la main : un
-- propriétaire qui recompte tombe sur le même chiffre. C'est la seule
-- propriété qui compte sur ce document.
--
-- Un mois sans encaissement produit une ligne à zéro plutôt qu'une absence :
-- le mandant doit voir que son lot n'a rien rapporté, pas croire à un oubli.
-- ============================================================

begin;

create or replace function public.owner_statement_lines(
  p_owner_id uuid,
  p_month    date
)
returns table (
  unit_id        uuid,
  property_name  text,
  unit_name      text,
  tenant_name    text,
  lease_id       uuid,
  expected       bigint,
  collected      bigint,
  fee            bigint,
  net            bigint,
  fee_rate_bp    integer
)
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_landlord uuid := private.current_landlord_id();
  v_from date := date_trunc('month', p_month)::date;
  v_to   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_rate integer;
begin
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;

  select o.fee_rate_bp into v_rate
  from public.owners o
  where o.id = p_owner_id
    and o.landlord_id = v_landlord
    and o.deleted_at is null;

  if v_rate is null then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  return query
  with scope as (
    select u.id as unit_id, pr.name as property_name, u.name as unit_name
    from public.units u
    join public.properties pr on pr.id = u.property_id
    where pr.owner_id = p_owner_id
      and pr.landlord_id = v_landlord
      and (pr.deleted_at is null or pr.deleted_at >= v_to)
      -- Un lot archivé en août ne doit pas vider le relevé de juillet déjà
      -- remis au mandant : un document produit une fois doit se reproduire à
      -- l'identique. On ne l'exclut qu'à partir du mois de son archivage.
      and (u.deleted_at is null or u.deleted_at >= v_to)
  ),
  active_lease as (
    -- Un seul bail par lot sur le mois : le plus récent qui le recouvre.
    -- L'exclusion anti-chevauchement de la migration 001 garantit l'unicité.
    select distinct on (l.unit_id)
      l.unit_id, l.id as lease_id, l.tenant_id
    from public.leases l
    join scope s on s.unit_id = l.unit_id
    where l.deleted_at is null
      and l.status in ('active', 'ended')
      and l.start_date < v_to
      and (l.end_date is null or l.end_date >= v_from)
    order by l.unit_id, l.start_date desc
  ),
  dues as (
    select l.unit_id, sum(d.amount_due)::bigint as expected
    from public.rent_dues d
    join public.leases l on l.id = d.lease_id
    join scope s2        on s2.unit_id = l.unit_id
    where d.deleted_at is null
      and d.status <> 'cancelled'
      and d.period_start < v_to
      and d.period_end  >= v_from
    group by l.unit_id
  ),
  cash as (
    -- Rattaché au LOT et non au bail affiché. Un lot qui change de locataire
    -- en cours de mois porte deux baux ; ne compter que le dernier ferait
    -- disparaître du relevé tout ce qu'a versé le locataire sortant, et
    -- l'agence conserverait la somme sans trace. Le mandant est propriétaire
    -- du lot, pas du bail.
    select l.unit_id, sum(a.amount_allocated)::bigint as collected
    from public.rent_reception_allocations a
    join public.rent_receptions r on r.id = a.rent_reception_id
    join public.rent_dues d       on d.id = a.rent_due_id
    join public.leases l          on l.id = d.lease_id
    join scope s2                 on s2.unit_id = l.unit_id
    where r.status = 'confirmed'
      and r.deleted_at is null
      and r.received_at >= v_from
      and r.received_at <  v_to
    group by l.unit_id
  )
  select
    s.unit_id,
    s.property_name,
    s.unit_name,
    nullif(btrim(concat_ws(' ', t.first_name, t.last_name)), ''),
    al.lease_id,
    coalesce(dd.expected, 0),
    coalesce(c.collected, 0),
    (coalesce(c.collected, 0) * v_rate) / 10000,
    coalesce(c.collected, 0) - (coalesce(c.collected, 0) * v_rate) / 10000,
    v_rate
  from scope s
  left join active_lease al on al.unit_id = s.unit_id
  left join public.tenants t on t.id = al.tenant_id
  left join dues dd on dd.unit_id  = s.unit_id
  left join cash c  on c.unit_id   = s.unit_id
  order by s.property_name, s.unit_name;
end;
$$;

revoke all on function public.owner_statement_lines(uuid, date) from public, anon;
grant execute on function public.owner_statement_lines(uuid, date) to authenticated;

-- ── Relevé complet, prêt pour le PDF ────────────────────────────────────────
create or replace function public.owner_statement(
  p_owner_id uuid,
  p_month    date
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_landlord uuid := private.current_landlord_id();
  v_owner    public.owners%rowtype;
  v_agency   public.landlords%rowtype;
  v_lines    jsonb;
  v_expected bigint;
  v_collected bigint;
  v_fee      bigint;
begin
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;

  select * into v_owner
  from public.owners
  where id = p_owner_id and landlord_id = v_landlord and deleted_at is null;
  if not found then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  select * into v_agency from public.landlords where id = v_landlord;

  select
    coalesce(jsonb_agg(to_jsonb(l) order by l.property_name, l.unit_name), '[]'::jsonb),
    coalesce(sum(l.expected), 0),
    coalesce(sum(l.collected), 0),
    coalesce(sum(l.fee), 0)
  into v_lines, v_expected, v_collected, v_fee
  from public.owner_statement_lines(p_owner_id, p_month) l;

  return jsonb_build_object(
    'owner', jsonb_build_object(
      'id', v_owner.id,
      'display_name', v_owner.display_name,
      'phone', v_owner.phone,
      'email', v_owner.email,
      'fee_rate_bp', v_owner.fee_rate_bp
    ),
    'agency', jsonb_build_object(
      'name', nullif(btrim(concat_ws(' ', v_agency.first_name, v_agency.last_name)), ''),
      'phone', v_agency.phone,
      'address', v_agency.address,
      'city', v_agency.city
    ),
    'period', jsonb_build_object(
      'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
      'from', date_trunc('month', p_month)::date,
      'to', (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
    ),
    'lines', v_lines,
    'totals', jsonb_build_object(
      'expected', v_expected,
      'collected', v_collected,
      'fee', v_fee,
      'net_due_to_owner', v_collected - v_fee,
      'outstanding', greatest(0, v_expected - v_collected)
    ),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.owner_statement(uuid, date) from public, anon;
grant execute on function public.owner_statement(uuid, date) to authenticated;

-- ── Vue de clôture : l'écran « où en est mon mois » de l'agence ────────────
create or replace view public.owner_month_summary as
with month as (
  select date_trunc('month', current_date)::date as f,
         (date_trunc('month', current_date) + interval '1 month')::date as t
),
per_unit as (
  -- Honoraires calculés LOT PAR LOT, à l'arrondi inférieur, exactement comme
  -- owner_statement. Appliquer le taux au total du mandant donnerait un net
  -- différent de celui du relevé remis : deux chiffres pour la même chose.
  select
    o.id as owner_id, o.landlord_id, o.display_name, o.fee_rate_bp,
    u.id as unit_id,
    coalesce(c.collected, 0)::bigint as collected,
    (coalesce(c.collected, 0) * o.fee_rate_bp / 10000)::bigint as fee
  from public.owners o
  join public.properties pr on pr.owner_id = o.id and pr.deleted_at is null
  join public.units u       on u.property_id = pr.id and u.deleted_at is null
  left join lateral (
    select sum(a.amount_allocated)::bigint as collected
    from public.rent_reception_allocations a
    join public.rent_receptions r on r.id = a.rent_reception_id
    join public.rent_dues d       on d.id = a.rent_due_id
    join public.leases l          on l.id = d.lease_id
    cross join month m
    where l.unit_id = u.id
      and r.status = 'confirmed' and r.deleted_at is null
      and r.received_at >= m.f and r.received_at < m.t
  ) c on true
  where o.deleted_at is null
)
select
  owner_id,
  landlord_id,
  display_name,
  fee_rate_bp,
  count(*)                            as units,
  sum(collected)::bigint              as collected,
  sum(fee)::bigint                    as fee,
  (sum(collected) - sum(fee))::bigint as net_due_to_owner
from per_unit
group by owner_id, landlord_id, display_name, fee_rate_bp;

-- La vue hérite de la RLS des tables sous-jacentes (security_invoker) : une
-- agence ne voit que ses propres mandants.
alter view public.owner_month_summary set (security_invoker = true);

revoke all on public.owner_month_summary from anon;
grant select on public.owner_month_summary to authenticated;

comment on view public.owner_month_summary is
  'Clôture du mois en cours par mandant : encaissé, honoraires, net à reverser.';

commit;
