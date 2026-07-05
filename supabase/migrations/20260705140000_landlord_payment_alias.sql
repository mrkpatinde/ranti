-- ============================================================
-- Migration : alias de paiement PI-SPI du propriétaire (Tier 1)
-- Contexte : PI-SPI (BCEAO) permet au locataire de payer le loyer
--   instantanément vers l'alias du propriétaire. Ranti NE détient
--   JAMAIS les fonds — il affiche seulement l'alias ; le paiement
--   reste hors Ranti (P2P entre wallets/banques), puis est déclaré
--   puis encaissé comme aujourd'hui. Aucun agrément EME/EDP requis.
--   Voir docs/decisions/ADR-009-pispi-payment-alias.md.
-- Ce que fait cette migration :
--   1. landlords.payment_alias (+ _type) — donnée mutable, HORS
--      identité verrouillée (ADR-002 ne couvre que l'identité).
--   2. get_rent_due_by_token expose l'alias au locataire sur la page
--      publique /confirmer (RPC SECURITY DEFINER, scope token).
--      Aucune autre donnée propriétaire n'est exposée ; l'alias est
--      par nature destiné à être partagé au payeur.
-- Additif et idempotent.
-- ============================================================

BEGIN;

alter table public.landlords
  add column if not exists payment_alias text,
  add column if not exists payment_alias_type text;

alter table public.landlords
  drop constraint if exists landlords_payment_alias_type_check;
alter table public.landlords
  add constraint landlords_payment_alias_type_check
  check (payment_alias_type is null or payment_alias_type in ('phone', 'address'));

alter table public.landlords
  drop constraint if exists landlords_payment_alias_len_check;
alter table public.landlords
  add constraint landlords_payment_alias_len_check
  check (payment_alias is null or char_length(payment_alias) between 1 and 64);

-- Le type de retour change → drop obligatoire avant recreate.
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
  declaration_status text,
  landlord_payment_alias text,
  landlord_payment_alias_type text
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
    ) as declaration_status,
    l.payment_alias as landlord_payment_alias,
    l.payment_alias_type as landlord_payment_alias_type
  from rent_dues rd
  join units u on u.id = rd.unit_id
  join tenants t on t.id = rd.tenant_id
  join landlords l on l.id = rd.landlord_id
  where rd.confirmation_token = p_token
    and rd.deleted_at is null;
$$;

revoke all on function public.get_rent_due_by_token(uuid) from public;
grant execute on function public.get_rent_due_by_token(uuid) to anon, authenticated;

COMMIT;
