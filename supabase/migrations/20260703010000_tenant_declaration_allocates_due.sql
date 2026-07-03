-- ============================================================
-- Migration : la déclaration locataire crée une allocation réelle
-- Problème (P0) : declare_rent_payment_by_token créait une
--   rent_receptions 'draft' SANS ligne rent_reception_allocations.
--   Le propriétaire pouvait confirmer une réception qui ne réduisait
--   aucune échéance, puis générer une quittance avec allocations: [].
--   De plus, le statut de déclaration était déduit de (unit_id,
--   tenant_id, période) au lieu de l'allocation exacte vers
--   rent_dues.id : une réception voisine de la même période pouvait
--   bloquer ou masquer une déclaration légitime.
-- Solution :
--   - Le statut de déclaration est calculé UNIQUEMENT via
--     rent_reception_allocations.rent_due_id = rd.id.
--   - La déclaration crée réception draft + allocation vers
--     l'échéance exacte, pour le reste dû réel
--     (amount_due - allocations confirmées).
--   - L'échéance est verrouillée FOR UPDATE : pas de double
--     déclaration concurrente.
--   - La RPC de lecture expose amount_remaining pour afficher le
--     reste à payer, pas le montant brut.
-- Idempotent (create or replace + drop de l'ancienne signature).
-- ============================================================

BEGIN;

-- L'ancienne signature (sans amount_remaining) doit être supprimée :
-- create or replace ne peut pas changer le type de retour.
drop function if exists public.get_rent_due_by_token(uuid);

create or replace function public.get_rent_due_by_token(p_token uuid)
returns table (
  id uuid,
  amount_due integer,
  amount_remaining integer,
  currency text,
  due_date date,
  period_start date,
  period_end date,
  status text,
  unit_name text,
  tenant_first_name text,
  declaration_status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rd.id,
    rd.amount_due,
    greatest(
      0,
      rd.amount_due - coalesce((
        select sum(a.amount_allocated)
        from rent_reception_allocations a
        join rent_receptions rr on rr.id = a.rent_reception_id
        where a.rent_due_id = rd.id
          and rr.status = 'confirmed'
          and rr.deleted_at is null
      ), 0)
    )::integer as amount_remaining,
    rd.currency,
    rd.due_date,
    rd.period_start,
    rd.period_end,
    rd.status,
    u.name as unit_name,
    t.first_name as tenant_first_name,
    -- Statut attaché à l'échéance EXACTE via ses allocations,
    -- jamais déduit de (unit, tenant, période).
    (
      select rr.status
      from rent_reception_allocations a
      join rent_receptions rr on rr.id = a.rent_reception_id
      where a.rent_due_id = rd.id
        and rr.deleted_at is null
        and rr.status in ('draft', 'confirmed')
      order by case rr.status when 'confirmed' then 0 else 1 end,
               rr.created_at desc
      limit 1
    ) as declaration_status
  from rent_dues rd
  join units u on u.id = rd.unit_id
  join tenants t on t.id = rd.tenant_id
  where rd.confirmation_token = p_token
    and rd.deleted_at is null;
$$;

create or replace function public.declare_rent_payment_by_token(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due rent_dues%rowtype;
  v_confirmed_paid integer;
  v_remaining integer;
  v_has_draft boolean;
  v_reception_id uuid;
begin
  -- Verrou : sérialise les déclarations concurrentes sur cette échéance.
  select * into v_due
  from rent_dues
  where confirmation_token = p_token
    and deleted_at is null
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_due.status in ('paid', 'cancelled') then
    return 'already_processed';
  end if;

  -- Reste dû réel = amount_due - allocations confirmées vers CETTE échéance.
  select coalesce(sum(a.amount_allocated), 0) into v_confirmed_paid
  from rent_reception_allocations a
  join rent_receptions rr on rr.id = a.rent_reception_id
  where a.rent_due_id = v_due.id
    and rr.status = 'confirmed'
    and rr.deleted_at is null;

  v_remaining := v_due.amount_due - v_confirmed_paid;

  if v_remaining <= 0 then
    return 'already_confirmed';
  end if;

  -- Déclaration déjà en attente ? Uniquement via allocation exacte.
  select exists (
    select 1
    from rent_reception_allocations a
    join rent_receptions rr on rr.id = a.rent_reception_id
    where a.rent_due_id = v_due.id
      and rr.status = 'draft'
      and rr.deleted_at is null
  ) into v_has_draft;

  if v_has_draft then
    return 'already_declared';
  end if;

  insert into rent_receptions (
    landlord_id, tenant_id, unit_id,
    amount_received, currency, payment_method,
    status, received_at, note
  ) values (
    v_due.landlord_id, v_due.tenant_id, v_due.unit_id,
    v_remaining, v_due.currency, 'other',
    'draft', now(),
    'Déclaré par le locataire — en attente de validation du propriétaire.'
  )
  returning id into v_reception_id;

  insert into rent_reception_allocations (
    landlord_id, rent_reception_id, rent_due_id, amount_allocated
  ) values (
    v_due.landlord_id, v_reception_id, v_due.id, v_remaining
  );

  return 'ok';
end;
$$;

revoke all on function public.get_rent_due_by_token(uuid) from public;
revoke all on function public.declare_rent_payment_by_token(uuid) from public;
grant execute on function public.get_rent_due_by_token(uuid) to anon, authenticated;
grant execute on function public.declare_rent_payment_by_token(uuid) to anon, authenticated;

COMMIT;
