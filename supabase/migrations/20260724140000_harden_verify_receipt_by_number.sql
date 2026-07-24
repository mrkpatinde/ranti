-- ============================================================
-- Durcissement de la vérification par numéro (revue /ship 2026-07-24)
--
-- Quatre findings convergents des revues spécialistes + red team :
--
-- 1. INDEX. receipt_number n'était couvert que par unique(landlord_id,
--    receipt_number), inutilisable en filtre sur la seule 2e colonne : chaque
--    appel anonyme coûtait un scan séquentiel, amplifié linéairement avec la
--    table. Index partiel aligné sur le prédicat de la fonction.
--
-- 2. UNE PASSE. L'ancien corps faisait count(*) puis re-select (deux scans,
--    et une fenêtre READ COMMITTED où la ligne pouvait disparaître entre les
--    deux, renvoyant match_count=1 avec des colonnes NULL). Une seule requête
--    limit 2 : l'ambiguïté se déduit du nombre de lignes rapportées.
--
-- 3. VERDICT SEUL. Les empreintes stockée + recalculée ne sortent plus par ce
--    chemin ÉNUMÉRABLE : elles constituaient un oracle de confirmation hors
--    ligne des champs volontairement retenus (le préimage receipt_number ||
--    issued_at || snapshot::text n'est ni salé ni à haute entropie). La
--    comparaison se fait ici, en SQL ; la fonction renvoie un état unique
--    (verified | unsealed | tampered | cancelled), même sémantique que
--    receiptIntegrityVerdict (lib/receipts/integrity.ts) : annulé prime,
--    pas d'empreinte stockée -> unsealed, divergence -> tampered.
--    Les empreintes restent exposées sur /verifier/[id] (UUID non devinable).
--
-- 4. tenant_ack RETIRÉ du retour : jamais rendu par la page, il laissait
--    l'état de contestation moissonnable par énumération.
--
-- get_receipt_by_token : transition unilateral -> read rendue auto-gardée
-- (WHERE re-vérifie l'état), fermant la course lecture-périmée relevée en
-- revue (un certify concurrent ne peut plus être écrasé par un « read »).
-- Même type de retour -> create or replace suffit, pas de drop.
-- ============================================================

begin;

-- 1. Index partiel aligné sur le prédicat de recherche publique.
create index if not exists receipts_receipt_number_idx
  on public.receipts (receipt_number)
  where deleted_at is null;

-- 2-4. Nouveau contrat de retour -> drop + recreate + regrant.
drop function if exists public.verify_receipt_by_number(text);

create function public.verify_receipt_by_number(p_number text)
returns table (
  match_count integer,
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  periods jsonb,
  integrity text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_number text := upper(trim(p_number));
  v_rows public.receipts[];
  v public.receipts%rowtype;
  v_computed text;
  v_integrity text;
begin
  if v_number is null or v_number !~ '^RNT-\d{4}-\d{4,}$' then
    return; -- format invalide -> introuvable, sans détail
  end if;

  -- Une seule passe : limit 2 suffit à distinguer unique / ambigu.
  select coalesce(array_agg(r), '{}') into v_rows
  from (
    select *
    from public.receipts
    where public.receipts.receipt_number = v_number
      and deleted_at is null
    limit 2
  ) r;

  if array_length(v_rows, 1) is null then
    return; -- aucun document
  end if;

  if array_length(v_rows, 1) > 1 then
    -- Ambigu (numéros par propriétaire) : aucun détail, la page explique.
    -- match_count = 2 vaut « plusieurs », le nombre exact n'est pas divulgué.
    return query
    select 2, null::text, null::text, null::text, null::timestamptz,
           null::jsonb, null::text;
    return;
  end if;

  v := v_rows[1];

  -- Verdict calculé ici, empreintes jamais renvoyées sur ce chemin.
  -- Priorités identiques à receiptIntegrityVerdict : annulé prime, pas
  -- d'empreinte stockée -> unsealed, toute divergence -> tampered.
  if v.status = 'cancelled' then
    v_integrity := 'cancelled';
  elsif v.sha256_fingerprint is null or btrim(v.sha256_fingerprint) = '' then
    v_integrity := 'unsealed';
  else
    v_computed := encode(
      digest(
        convert_to(
          v.receipt_number
            || to_char(v.issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
            || v.snapshot::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    v_integrity := case when v_computed = v.sha256_fingerprint then 'verified' else 'tampered' end;
  end if;

  return query
  select
    1,
    v.receipt_number,
    v.kind,
    v.status,
    v.issued_at,
    -- Périodes seules : les montants ne sortent jamais par ce chemin.
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'period_start', a ->> 'period_start',
        'period_end', a ->> 'period_end'
      ))
      from jsonb_array_elements(coalesce(v.snapshot -> 'allocations', '[]'::jsonb)) a
    ), '[]'::jsonb),
    v_integrity;
end;
$$;

revoke all on function public.verify_receipt_by_number(text) from public;
grant execute on function public.verify_receipt_by_number(text) to anon, authenticated;

-- Transition première ouverture auto-gardée : le WHERE re-vérifie l'état au
-- moment de l'écriture, un certify/dispute concurrent ne peut plus être
-- écrasé. Type de retour inchangé -> create or replace.
create or replace function public.get_receipt_by_token(p_token uuid)
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
  v_updated integer;
begin
  select * into v
  from public.receipts
  where tenant_token = p_token and deleted_at is null;

  if not found then
    return;
  end if;

  -- Premiere ouverture : unilateral -> read (indicateur produit, sans valeur
  -- juridique tacite). Auto-gardé : le WHERE re-teste l'état, un certify ou
  -- dispute intercalé n'est jamais écrasé ; on ne reflète la transition dans
  -- la ligne renvoyée que si l'UPDATE a réellement porté.
  if v.tenant_ack = 'unilateral' then
    update public.receipts
    set tenant_ack = 'read', tenant_read_at = now()
    where id = v.id and tenant_ack = 'unilateral';
    get diagnostics v_updated = row_count;
    if v_updated = 1 then
      v.tenant_ack := 'read';
      v.tenant_read_at := now();
    else
      select * into v
      from public.receipts
      where tenant_token = p_token and deleted_at is null;
    end if;
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
