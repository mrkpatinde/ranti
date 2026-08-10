-- ============================================================
-- 20260810130000 — RCCM et IFU de l'entreprise de gestion (pivot ADR-029)
-- ============================================================
-- L'onboarding bifurque désormais explicitement : « une entreprise de
-- gestion » ou « je gère en mon nom propre » (retour fondateur 2026-08-10).
-- Une entreprise s'identifie au Bénin par sa raison sociale (déjà en base,
-- migration 20260810120000), son RCCM (registre du commerce) et son IFU
-- (identifiant fiscal). Les documents qu'elle émet — quittances, relevés de
-- gestion — doivent pouvoir porter ces identifiants.
--
-- 1. `landlords.company_rccm` / `landlords.company_ifu` (nullables) : les
--    identifiants légaux de l'entreprise. Null reste l'état légitime d'une
--    gestion en nom propre — aucune valeur par défaut.
--
--    Colonnes MUTABLES, pour les mêmes raisons que company_name (migration
--    20260810120000, qui démontre que le verrou d'identité ADR-002 —
--    trigger `landlords_identity_lock`, déclaré sur first_name / last_name /
--    civility / phone — ne se déclenche pas sur ces colonnes) : les snapshots
--    de quittance sont figés à l'émission et scellés (HMAC, 20260809120300),
--    corriger un RCCM mal saisi ne réécrit pas l'histoire, seuls les
--    documents émis ensuite portent la valeur corrigée.
--
--    Grants : `authenticated` détient INSERT / SELECT / UPDATE au niveau
--    TABLE sur public.landlords (20260714170000) ; une colonne ajoutée
--    hérite de ces privilèges, aucun regrant n'est nécessaire.
--
-- 2. `private.generate_receipt_core` : le bloc `landlord` du snapshot gagne
--    `company_rccm` / `company_ifu`. Corps repris À L'IDENTIQUE de la version
--    en base (celle de 20260810120000 — lue via prosrc, jamais depuis un
--    vieux fichier : leçon des fusions précédentes), seules les deux clés
--    sont ajoutées. L'empreinte est calculée APRÈS la construction du
--    snapshot : elle couvre les nouvelles clés sans qu'aucune autre ligne ne
--    bouge. Les documents déjà émis conservent leur snapshot sans ces clés
--    (rétrocompatibilité côté app) ; leurs sceaux couvrent leur snapshot
--    d'origine et restent valides.
--
-- 3. `public.owner_statement` : le bloc `agency` du relevé expose
--    `company_rccm` / `company_ifu`. Même méthode : corps repris de la base,
--    deux clés ajoutées, rien d'autre.
--
-- create or replace suffit partout : aucun type de retour ne change.
-- ============================================================

begin;

-- ── 1. Identifiants légaux de l'entreprise ──────────────────────────────────
alter table public.landlords add column if not exists company_rccm text;
alter table public.landlords add column if not exists company_ifu text;

comment on column public.landlords.company_rccm is
  'RCCM de l''entreprise de gestion. Null = gestion en nom propre ou non
   renseigné. Mutable (hors verrou ADR-002) : les documents émis sont figés
   au snapshot (cf. migration 20260810120000, mêmes raisons que company_name).';
comment on column public.landlords.company_ifu is
  'IFU de l''entreprise de gestion. Null = gestion en nom propre ou non
   renseigné. Mutable (hors verrou ADR-002) : les documents émis sont figés
   au snapshot (cf. migration 20260810120000, mêmes raisons que company_name).';

-- ── 2. Snapshot de quittance : rccm/ifu dans le bloc landlord ───────────────
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
    -- Émetteur figé à l'émission (pivot agences, 20260810120000 ; rccm/ifu
    -- ajoutés en 20260810130000) : l'identité imprimée sur la quittance ne
    -- bouge plus après coup. Clés lues par le rendu app ; absentes des
    -- snapshots antérieurs (le rendu retombe alors sur le nom de la
    -- personne, sans ligne RCCM/IFU).
    'landlord', (
      select jsonb_build_object(
        'first_name', first_name,
        'last_name', last_name,
        'company_name', company_name,
        'company_rccm', company_rccm,
        'company_ifu', company_ifu
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

-- ── 3. Relevé du mandant : rccm/ifu dans le bloc agency ─────────────────────
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
      -- Identifiants légaux (20260810130000) : rendus en petite ligne sous le
      -- nom quand présents, ignorés sinon.
      'company_rccm', v_agency.company_rccm,
      'company_ifu', v_agency.company_ifu,
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
