-- ============================================================
-- Moyen de paiement sur la quittance partagée (conformité, Loi n°2022-30)
--
-- ADR-027 : la quittance est la preuve légale du paiement mensuel du loyer
-- (art. 67). Le snapshot porte déjà reception.payment_method et
-- reception.received_at (generate_receipt_core), et le PDF côté propriétaire
-- les affiche. Mais get_receipt_by_token ne les renvoyait pas : la page
-- publique /recu/[token] et le PDF token (celui que le locataire télécharge
-- et partage) sortaient SANS moyen de paiement ni date de réception.
--
-- Ajout de deux colonnes au retour : payment_method, received_at, lues du
-- snapshot (figées à l'émission, couvertes par l'empreinte d'intégrité comme
-- le reste du snapshot). Ajouter des colonnes = changement de type de retour,
-- interdit par create or replace -> drop + recreate + regrant.
-- ============================================================

begin;

drop function if exists public.get_receipt_by_token(uuid);

create function public.get_receipt_by_token(p_token uuid)
returns table (
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  total_amount integer,
  currency text,
  landlord_first_name text,
  landlord_last_name text,
  landlord_address text,
  landlord_city text,
  tenant_first_name text,
  tenant_last_name text,
  unit_name text,
  property_city text,
  property_address text,
  allocations jsonb,
  payment_method text,
  received_at timestamptz,
  tenant_ack text,
  tenant_read_at timestamptz,
  tenant_certified_at timestamptz,
  contested_at timestamptz,
  contest_nature text,
  contested_amount integer,
  contested_period text,
  sha256_fingerprint text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.receipts%rowtype;
begin
  select * into v
  from public.receipts
  where tenant_token = p_token and deleted_at is null;

  if not found then
    return;
  end if;

  -- Premiere ouverture : unilateral -> read (indicateur produit, sans valeur
  -- juridique tacite). Ne touche jamais un recu deja certifie/conteste.
  if v.tenant_ack = 'unilateral' then
    update public.receipts
    set tenant_ack = 'read', tenant_read_at = now()
    where id = v.id;
    v.tenant_ack := 'read';
    v.tenant_read_at := now();
  end if;

  return query
  select
    v.receipt_number,
    v.kind,
    v.status,
    v.issued_at,
    v.total_amount,
    v.currency,
    l.first_name,
    l.last_name,
    l.address,
    l.city,
    v.snapshot -> 'tenant' ->> 'first_name',
    v.snapshot -> 'tenant' ->> 'last_name',
    v.snapshot -> 'unit' ->> 'name',
    v.snapshot -> 'property' ->> 'city',
    v.snapshot -> 'property' ->> 'address',
    coalesce(v.snapshot -> 'allocations', '[]'::jsonb),
    v.snapshot -> 'reception' ->> 'payment_method',
    (v.snapshot -> 'reception' ->> 'received_at')::timestamptz,
    v.tenant_ack,
    v.tenant_read_at,
    v.tenant_certified_at,
    v.contested_at,
    v.contest_nature,
    v.contested_amount,
    v.contested_period,
    v.sha256_fingerprint
  from public.landlords l
  where l.id = v.landlord_id;
end;
$$;

revoke all on function public.get_receipt_by_token(uuid) from public;
grant execute on function public.get_receipt_by_token(uuid) to anon, authenticated;

commit;
