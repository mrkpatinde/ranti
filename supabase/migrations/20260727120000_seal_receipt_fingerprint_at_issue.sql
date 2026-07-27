-- ============================================================
-- Sceller l'empreinte d'intégrité À L'ÉMISSION, plus à la certification
--
-- Jusqu'ici `sha256_fingerprint` n'était écrite que par
-- certify_receipt_by_token : une quittance n'était scellée QUE si le locataire
-- ouvrait son lien et cliquait. Conséquence produit : la quittance fraîche —
-- celle qu'un locataire présente à une banque ou à un consulat — sortait en
-- `unsealed` sur /verifier, avec le message « aucune empreinte d'intégrité n'y
-- est scellée ». Le levier de vérification publique était donc éteint par
-- défaut, et son allumage dépendait d'un geste locataire jamais mesuré.
--
-- Le contenu couvert par l'empreinte (receipt_number, issued_at, snapshot) est
-- FIGÉ dès l'insertion : rien n'empêchait de sceller là. C'est ce que fait
-- cette migration.
--
-- Quatre changements, une seule recette :
--
-- 1. private.receipt_computed_fingerprint(number, issued_at, snapshot) —
--    SOURCE UNIQUE de la recette d'empreinte. Elle était copiée-collée dans
--    trois fonctions vivantes (certify_receipt_by_token,
--    verify_receipt_integrity, verify_receipt_by_number) ; sceller à l'émission
--    en aurait fait une quatrième. Une copie divergente ferait rendre deux
--    verdicts opposés sur le MÊME document selon le chemin (QR vs référence) —
--    exactement ce qui détruit la valeur de preuve. Dette levée ici (TODOS P1).
--    En schéma `private` : jamais exposée par PostgREST, contrairement à un
--    helper `public` qui deviendrait un endpoint /rpc inutile.
--
-- 2. private.generate_receipt_core scelle dans l'INSERT. `issued_at` est posé
--    explicitement (v_issued := now(), identique au DEFAULT now() puisque now()
--    est le timestamp de transaction) au lieu d'être laissé au défaut : il faut
--    la valeur AVANT l'insertion pour calculer l'empreinte. Sceller par un
--    UPDATE après INSERT aurait produit une seconde ligne d'audit
--    (trigger receipts_audit, `after insert or update`) et un bruit de
--    updated_at sur chaque émission.
--
-- 3. certify_receipt_by_token NE RÉÉCRIT PLUS un sceau existant (coalesce).
--    La certification reste ce qu'elle est — la deuxième voix, ADR-013 — et
--    cesse d'être ce qui fait exister la preuve d'intégrité. Elle scelle encore
--    les documents ANTÉRIEURS à cette migration, qui n'ont pas de sceau.
--
-- 4. verify_receipt_integrity et verify_receipt_by_number délèguent au helper.
--    Verdicts inchangés à l'octet près : la recette est identique, seule sa
--    localisation change.
--
-- Ce que l'empreinte prouve, et ne prouve pas — inchangé par cette migration :
-- SHA-256 sans secret, stockée dans la table qu'elle protège. Elle détecte une
-- altération partielle ou accidentelle du snapshot ; elle ne protège PAS contre
-- un porteur du service_role qui modifierait le snapshot et rejouerait le
-- calcul. Opposable au tiers, pas à l'éditeur.
--
-- Documents déjà émis : voir la migration 20260727120010 (rétro-scellement),
-- volontairement séparée — c'est une décision distincte.
-- ============================================================

begin;

-- ── 1. Source unique de la recette d'empreinte ──────────────────────────────
-- STABLE et non IMMUTABLE : to_char(timestamp, text) dépend de DateStyle /
-- lc_time. Suffisant ici (appelée en projection, jamais indexée).
create or replace function private.receipt_computed_fingerprint(
  p_receipt_number text,
  p_issued_at timestamptz,
  p_snapshot jsonb
)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(
    digest(
      convert_to(
        p_receipt_number
          || to_char(p_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
          || p_snapshot::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function private.receipt_computed_fingerprint(text, timestamptz, jsonb) is
  'Recette UNIQUE de l''empreinte d''intégrité (ADR-013). Toute fonction qui '
  'scelle ou revérifie DOIT passer par ici : deux recettes = deux verdicts '
  'possibles sur le même document.';

revoke all on function private.receipt_computed_fingerprint(text, timestamptz, jsonb)
  from public, anon;
-- generate_receipt_core est SECURITY INVOKER : il exécute sous le rôle appelant.
-- Les fonctions de vérification sont SECURITY DEFINER et n'en ont pas besoin.
grant execute on function private.receipt_computed_fingerprint(text, timestamptz, jsonb)
  to authenticated, service_role;

-- ── 2. Émission : le sceau est posé dans l'INSERT ───────────────────────────
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
  v_issued timestamptz;
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

  -- Emission scellee : issued_at fige ICI (now() = timestamp de transaction,
  -- donc identique au DEFAULT qu'il remplace) pour entrer dans l'empreinte.
  -- Le sceau part dans l'INSERT : un UPDATE post-insert doublerait la ligne
  -- d'audit (trigger receipts_audit) et bougerait updated_at pour rien.
  v_issued := now();

  insert into public.receipts (
    landlord_id, rent_reception_id, receipt_number, issued_at,
    total_amount, currency, status, kind, snapshot, sha256_fingerprint
  )
  values (
    lid, p_reception_id, v_num, v_issued,
    rec.amount_received, rec.currency, 'issued', v_kind, v_snapshot,
    private.receipt_computed_fingerprint(v_num, v_issued, v_snapshot)
  )
  returning id into rid;

  return rid;
end;
$function$;

-- ── 3. Certification : ne réécrit jamais un sceau d'émission ────────────────
create or replace function public.certify_receipt_by_token(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.receipts%rowtype;
begin
  select * into v
  from public.receipts
  where tenant_token = p_token and deleted_at is null
  for update;

  if not found then return 'not_found'; end if;
  if v.status = 'cancelled' then return 'cancelled'; end if;
  if v.tenant_ack = 'certified' then return 'already_certified'; end if;
  if v.tenant_ack = 'disputed' then return 'disputed'; end if;

  -- Le sceau est posé à l'ÉMISSION depuis 2026-07-27. La certification est la
  -- deuxième voix (ADR-013 §4) : elle atteste l'exactitude, elle ne fabrique
  -- plus l'intégrité. coalesce = on ne réécrit jamais un sceau existant (même
  -- recette, donc même valeur : réécrire serait au mieux inutile, au pire un
  -- moyen de re-sceller un contenu modifié entre-temps). Le calcul ne sert
  -- plus qu'aux documents ANTÉRIEURS, émis sans sceau.
  update public.receipts
  set tenant_ack = 'certified',
      tenant_certified_at = now(),
      sha256_fingerprint = coalesce(
        v.sha256_fingerprint,
        private.receipt_computed_fingerprint(v.receipt_number, v.issued_at, v.snapshot)
      )
  where id = v.id;

  return 'ok';
end;
$$;

-- ── 4. Vérification : les deux chemins délèguent au helper ──────────────────
create or replace function public.verify_receipt_integrity(p_id uuid)
returns table (
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  tenant_first_name text,
  tenant_last_name text,
  unit_name text,
  allocations jsonb,
  tenant_ack text,
  stored_fingerprint text,
  computed_fingerprint text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.receipts%rowtype;
begin
  select * into v
  from public.receipts
  where id = p_id and deleted_at is null;

  if not found then
    return; -- aucune ligne -> la page rend un 404
  end if;

  return query
  select
    v.receipt_number,
    v.kind,
    v.status,
    v.issued_at,
    v.snapshot -> 'tenant' ->> 'first_name',
    v.snapshot -> 'tenant' ->> 'last_name',
    v.snapshot -> 'unit' ->> 'name',
    coalesce(v.snapshot -> 'allocations', '[]'::jsonb),
    v.tenant_ack,
    v.sha256_fingerprint,
    -- Recalcul par la recette unique. Toute divergence avec le sceau =
    -- contenu altéré depuis l'émission.
    private.receipt_computed_fingerprint(v.receipt_number, v.issued_at, v.snapshot);
end;
$$;

revoke all on function public.verify_receipt_integrity(uuid) from public;
grant execute on function public.verify_receipt_integrity(uuid) to anon, authenticated;

create or replace function public.verify_receipt_by_number(p_number text)
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

  -- Verdict calculé ici, empreintes jamais renvoyées sur ce chemin énumérable.
  -- Priorités identiques à receiptIntegrityVerdict : annulé prime, pas
  -- d'empreinte stockée -> unsealed, toute divergence -> tampered.
  if v.status = 'cancelled' then
    v_integrity := 'cancelled';
  elsif v.sha256_fingerprint is null or btrim(v.sha256_fingerprint) = '' then
    v_integrity := 'unsealed';
  elsif private.receipt_computed_fingerprint(v.receipt_number, v.issued_at, v.snapshot)
        = v.sha256_fingerprint then
    v_integrity := 'verified';
  else
    v_integrity := 'tampered';
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

-- ── 5. Le commentaire de colonne ne dit plus « à la certification » ─────────
comment on column public.receipts.sha256_fingerprint is
  'Empreinte d''intégrité du contenu figé, scellée À L''ÉMISSION (depuis '
  '2026-07-27 ; auparavant à la certification locataire). Null = document '
  'antérieur jamais certifié. Pas une identité, pas une signature : SHA-256 '
  'sans secret, opposable au tiers, pas à l''éditeur.';

commit;
