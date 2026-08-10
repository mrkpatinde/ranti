-- ============================================================
-- 20260810120000 — Raison sociale de l'entreprise de gestion (pivot ADR-029)
-- ============================================================
-- Le compte connecté est une entreprise de gestion immobilière ; or le profil
-- ne portait qu'une identité de personne physique (civilité, prénom, nom,
-- téléphone). Les documents qu'elle émet — quittances, relevés de gestion —
-- doivent pouvoir porter sa raison sociale.
--
-- 1. `landlords.company_name` (nullable) : la raison sociale. Un gestionnaire
--    en nom propre n'en a pas — null reste un état légitime, aucune valeur par
--    défaut.
--
--    La colonne est MUTABLE, volontairement, contrairement à l'identité de la
--    personne (ADR-002). Preuve que le verrou d'identité ne la bloque pas :
--    le trigger `landlords_identity_lock` (migration 20260716070000) est
--    déclaré `before update OF first_name, last_name, civility, phone` — il ne
--    se déclenche QUE si l'une de ces quatre colonnes figure dans le SET de
--    l'UPDATE. Un `update ... set company_name = ...` ne le réveille donc
--    jamais ; et même réveillé (SET mixte), sa fonction ne rejette que si
--    first_name / last_name / civility / phone changent réellement. La liberté
--    de modification est assumée : les snapshots de quittance sont figés à
--    l'émission et scellés (HMAC, migration 20260809120300) — changer de
--    raison sociale ne réécrit pas l'histoire, seuls les documents émis
--    ensuite portent le nouveau nom.
--
--    Grants : `authenticated` détient INSERT / SELECT / UPDATE au niveau TABLE
--    sur public.landlords (20260714170000) ; une colonne ajoutée hérite de ces
--    privilèges de table, aucun regrant n'est nécessaire.
--
-- 2. `private.generate_receipt_core` : le snapshot figé gagne un bloc
--    `landlord` (prénom, nom, raison sociale). Jusqu'ici l'émetteur était lu
--    EN DIRECT (jointure landlords) et le snapshot ne portait aucun bloc
--    landlord. Le bloc fige l'émetteur au moment de l'émission : la raison
--    sociale imprimée sur une quittance ne bouge plus, même si l'entreprise
--    en change ensuite. L'empreinte étant calculée sur le snapshot COMPLET
--    (recette unique, 20260727120000 durcie en 20260809120300), le bloc est
--    couvert par le sceau. Les reçus déjà émis conservent leur snapshot sans
--    la clé (rétrocompatibilité assurée côté app) ; leurs sceaux couvrent
--    leur snapshot d'origine et restent valides.
--
-- 3. `public.owner_statement` : le bloc `agency` du relevé expose
--    `company_name`, et son champ `name` devient
--    coalesce(company_name, concat_ws(' ', first_name, last_name)) — le relevé
--    remis au mandant est au nom de l'entreprise dès qu'elle en a un.
--
-- create or replace suffit partout : aucun type de retour ne change.
-- Rien d'autre n'est touché (get_receipt_by_token, notamment, reste tel quel :
-- la vue token continue d'exposer l'identité de la personne).
-- ============================================================

begin;

-- ── 1. Raison sociale ───────────────────────────────────────────────────────
alter table public.landlords add column if not exists company_name text;

comment on column public.landlords.company_name is
  'Raison sociale de l''entreprise de gestion. Null = gestion en nom propre.
   Mutable (hors verrou ADR-002) : les documents émis sont figés au snapshot.';

-- ── 2. Snapshot de quittance : bloc landlord (émetteur figé) ────────────────
-- Corps repris à l'identique de la version en base (20260727120000 — celle
-- qui pose issued_at et scelle l'empreinte dans l'INSERT), seul le bloc
-- 'landlord' est ajouté au snapshot. L'empreinte est calculée APRÈS la
-- construction du snapshot : elle couvre donc le nouveau bloc sans qu'aucune
-- autre ligne ne bouge.
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
    -- Émetteur figé à l'émission (pivot agences, 20260810120000) : la raison
    -- sociale imprimée sur la quittance ne bouge plus après coup. Clé lue par
    -- le rendu app ; absente des snapshots antérieurs (le rendu retombe alors
    -- sur le nom de la personne).
    'landlord', (
      select jsonb_build_object(
        'first_name', first_name,
        'last_name', last_name,
        'company_name', company_name
      )
      from public.landlords where id = lid
    ),
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

-- ── 3. Relevé du mandant : en-tête au nom de l'entreprise ───────────────────
-- Corps repris à l'identique de 20260809120700 ; seul le bloc 'agency' change
-- (company_name exposé, name = coalesce raison sociale / personne).
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
      -- Raison sociale d'abord ; repli sur la personne pour une gestion en
      -- nom propre. Le relevé reste toujours signé d'un nom.
      'name', coalesce(
        nullif(btrim(v_agency.company_name), ''),
        nullif(btrim(concat_ws(' ', v_agency.first_name, v_agency.last_name)), '')
      ),
      'company_name', v_agency.company_name,
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

-- create or replace conserve les ACL ; on les réaffirme par convention maison
-- (leçon « policy correcte + GRANT oublié »).
revoke all on function public.owner_statement(uuid, date) from public, anon;
grant execute on function public.owner_statement(uuid, date) to authenticated;

commit;
