-- ============================================================
-- Adresse du bailleur sur la quittance (conformité bail d'habitation, Bénin)
--
-- Loi n°2022-30 du 20/12/2022, art. 67 : le loyer est payable « au domicile du
-- bailleur ou de son représentant contre une quittance ». La quittance doit
-- identifier complètement le bailleur ; jusqu'ici le bloc « De » ne portait que
-- nom + téléphone. On ajoute l'adresse postale du bailleur.
--
-- Donnée MUTABLE (contact), distincte de l'identité verrouillée (ADR-002, nom /
-- téléphone). Colonnes nullables : non renseignées à l'onboarding rapide.
--
-- L'identité du bailleur est lue EN DIRECT (jointure landlords), jamais figée au
-- snapshot : l'adresse suit la même règle que le nom déjà exposé. L'empreinte
-- d'intégrité (SHA-256 sur receipt_number || issued_at || snapshot) ne couvre
-- pas le bloc bailleur, ici comme avant ; rien à recalculer.
--
-- OHADA (AUDCG art. 101 et s.) ne régit que le bail à usage professionnel, pas
-- l'habitation : ici c'est bien le régime d'habitation (Loi 2022-30) qui fonde
-- la mention.
-- ============================================================

begin;

alter table public.landlords add column if not exists address text;
alter table public.landlords add column if not exists city text;

-- get_receipt_by_token : exposer landlord_address / landlord_city au locataire
-- (page publique + PDF token). Ajouter des colonnes = changement de type de
-- retour, interdit par create or replace -> drop + recreate + regrant.
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
