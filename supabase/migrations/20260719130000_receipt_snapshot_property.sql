-- ============================================================
-- Identification du logement sur la quittance (bail d'habitation, Bénin)
--
-- Une quittance doit identifier le bien loué. Jusqu'ici le snapshot ne figeait
-- que le NOM du logement (« Chambre 1 », « Studio »), jamais l'adresse. Le
-- régime du bail à usage d'habitation (Loi n°2022-30, art. 67, Bénin) attend
-- une quittance qui identifie clairement le logement occupé : son adresse doit
-- figurer. (L'OHADA AUDCG ne régit que le bail professionnel, hors périmètre.)
--
-- 1. private.generate_receipt_core : ajoute la clé 'property' au snapshot figé
--    (nom + ville + adresse de la propriété parente). create or replace : seul
--    le corps change, le type de retour (uuid) est inchangé.
-- 2. public.get_receipt_by_token : expose property_city / property_address au
--    locataire. Ajouter des colonnes = changement de type de retour, interdit
--    par create or replace -> drop + recreate + regrant.
--
-- Les reçus déjà émis conservent leur snapshot figé (sans clé 'property') :
-- l'adresse n'apparaît que sur les quittances émises à partir d'ici. city et
-- address restent nullables (non renseignés à l'onboarding rapide).
-- ============================================================

begin;

-- 1. Snapshot enrichi ────────────────────────────────────────────────────────
create or replace function private.generate_receipt_core(p_landlord_id uuid, p_reception_id uuid)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  lid uuid := p_landlord_id;
  rec public.rent_receptions;
  existing uuid;
  v_num text;
  v_snapshot jsonb;
  v_kind text;
  rid uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;

  select * into rec from public.rent_receptions
  where id = p_reception_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'reception_not_found' using errcode = 'P0002'; end if;
  if rec.status <> 'confirmed' then
    raise exception 'reception_not_confirmed' using errcode = 'P0001';
  end if;

  -- Idempotence : renvoyer le receipt ACTIF existant (pas un annule).
  select id into existing from public.receipts
  where rent_reception_id = p_reception_id
    and status = 'issued' and deleted_at is null;
  if existing is not null then
    return existing;
  end if;

  -- Serialize receipt-number generation per landlord (avoids count(*)+1 race).
  perform pg_advisory_xact_lock(hashtextextended(lid::text, 0));

  -- Reference RNT-AAAA-NNNN : sequence par proprietaire remise a zero par
  -- annee. Minimum 4 chiffres, jamais tronquee au-dela (lpad tronquerait).
  select 'RNT-' || to_char(now(), 'YYYY') || '-' ||
         lpad((count(*) + 1)::text,
              greatest(4, length((count(*) + 1)::text)), '0') into v_num
  from public.receipts
  where landlord_id = lid
    and receipt_number like ('RNT-' || to_char(now(), 'YYYY') || '-%');

  -- Quittance only if every allocated due is fully paid; else a receipt.
  select case
           when bool_and(d.status = 'paid') then 'quittance'
           else 'receipt'
         end
    into v_kind
  from public.rent_reception_allocations a
  join public.rent_dues d on d.id = a.rent_due_id
  where a.rent_reception_id = rec.id;
  v_kind := coalesce(v_kind, 'receipt');

  v_snapshot := jsonb_build_object(
    'tenant', (
      select jsonb_build_object('first_name', first_name, 'last_name', last_name, 'phone', phone)
      from public.tenants where id = rec.tenant_id
    ),
    'unit', (
      select jsonb_build_object('name', name, 'type', unit_type)
      from public.units where id = rec.unit_id
    ),
    -- Adresse du local figee depuis la propriete parente (identification du
    -- bien loue sur la quittance). city / address peuvent etre null.
    'property', (
      select jsonb_build_object('name', p.name, 'city', p.city, 'address', p.address)
      from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = rec.unit_id
    ),
    'reception', jsonb_build_object(
      'amount_received', rec.amount_received,
      'currency', rec.currency,
      'payment_method', rec.payment_method,
      'received_at', rec.received_at
    ),
    'allocations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'period_start', d.period_start,
          'period_end', d.period_end,
          'amount_allocated', a.amount_allocated
        ) order by d.period_start
      )
      from public.rent_reception_allocations a
      join public.rent_dues d on d.id = a.rent_due_id
      where a.rent_reception_id = rec.id
    ), '[]'::jsonb)
  );

  insert into public.receipts (
    landlord_id, rent_reception_id, receipt_number, total_amount, currency, status, kind, snapshot
  )
  values (
    lid, p_reception_id, v_num, rec.amount_received, rec.currency, 'issued', v_kind, v_snapshot
  )
  returning id into rid;

  return rid;
end;
$function$;

-- 2. Vue token enrichie (drop + recreate : signature de retour modifiee) ──────
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
