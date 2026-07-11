-- ============================================================
-- ADR-013 — Contestation locataire & statuts probants du reçu
--
-- Ajoute au reçu un cycle d'acquittement locataire (tenant_ack) parallèle
-- au cycle de vie du document (status issued/cancelled), un accès public par
-- token, et le stockage isolé de la version du locataire en cas de
-- contestation. Ranti documente le désaccord, ne l'arbitre pas.
--
-- L'anon n'accède à aucune table en direct : trois RPC SECURITY DEFINER
-- clés sur le token UUID (non devinable), même modèle qu'ADR sur /confirmer.
-- Idempotent.
-- ============================================================

BEGIN;

-- ── 1. Colonnes d'acquittement + contestation ──────────────────────────────
alter table public.receipts
  add column if not exists tenant_ack text not null default 'unilateral'
    check (tenant_ack in ('unilateral', 'read', 'certified', 'disputed')),
  add column if not exists tenant_token uuid not null default gen_random_uuid(),
  add column if not exists tenant_read_at timestamptz,
  add column if not exists tenant_certified_at timestamptz,
  add column if not exists contested_at timestamptz,
  add column if not exists contest_nature text
    check (contest_nature in ('amount', 'date', 'not_paid')),
  add column if not exists contested_amount integer,
  add column if not exists contested_period text,
  add column if not exists sha256_fingerprint text;

-- Chaque reçu existant reçoit un token distinct (gen_random_uuid volatile,
-- évalué par ligne au moment de l'ADD COLUMN).
create unique index if not exists receipts_tenant_token_key
  on public.receipts (tenant_token);

comment on column public.receipts.tenant_ack is
  'Cycle d''acquittement locataire (ADR-013), orthogonal à status.';
comment on column public.receipts.sha256_fingerprint is
  'Empreinte d''intégrité du contenu figé à la certification. Pas une identité.';

-- ── 2. Lecture publique par token (pose read à la 1re ouverture) ────────────
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
  tenant_first_name text,
  tenant_last_name text,
  unit_name text,
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

  -- Première ouverture : unilateral -> read (indicateur produit, sans valeur
  -- juridique tacite). Ne touche jamais un reçu déjà certifié/contesté.
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

-- ── 3. Certification : le locataire confirme l'exactitude ───────────────────
create or replace function public.certify_receipt_by_token(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.receipts%rowtype;
  v_fp text;
begin
  select * into v
  from public.receipts
  where tenant_token = p_token and deleted_at is null
  for update;

  if not found then return 'not_found'; end if;
  if v.status = 'cancelled' then return 'cancelled'; end if;
  if v.tenant_ack = 'certified' then return 'already_certified'; end if;
  if v.tenant_ack = 'disputed' then return 'disputed'; end if;

  -- Empreinte sur le contenu figé (numéro + émission + snapshot). Garantit
  -- l'intégrité du document, pas l'identité du cliqueur (ADR-013 §4).
  -- issued_at figé en UTC déterministe : l'empreinte ne dépend pas du fuseau
  -- de session, une revérification donne le même hash partout.
  v_fp := encode(
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

  update public.receipts
  set tenant_ack = 'certified',
      tenant_certified_at = now(),
      sha256_fingerprint = v_fp
  where id = v.id;

  return 'ok';
end;
$$;

-- ── 4. Contestation : la version du locataire, isolée ───────────────────────
create or replace function public.contest_receipt_by_token(
  p_token uuid,
  p_nature text,
  p_amount integer,
  p_period text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.receipts%rowtype;
begin
  if p_nature is null or p_nature not in ('amount', 'date', 'not_paid') then
    return 'invalid_nature';
  end if;

  select * into v
  from public.receipts
  where tenant_token = p_token and deleted_at is null
  for update;

  if not found then return 'not_found'; end if;
  if v.status = 'cancelled' then return 'cancelled'; end if;
  if v.tenant_ack = 'certified' then return 'already_certified'; end if;
  -- Une contestation est figée : un 2e clic n'écrase pas la 1re version.
  if v.tenant_ack = 'disputed' then return 'already_disputed'; end if;

  -- La déclaration du bailleur (snapshot) n'est jamais écrasée : la version du
  -- locataire vit dans des colonnes dédiées -> PDF « deux voix ».
  update public.receipts
  set tenant_ack = 'disputed',
      contested_at = now(),
      contest_nature = p_nature,
      contested_amount = case when p_nature = 'amount' then p_amount else null end,
      contested_period = case when p_nature = 'date' then p_period else null end
  where id = v.id;

  return 'ok';
end;
$$;

-- ── 5. Grants : l'anon ne peut appeler que ces trois fonctions ──────────────
revoke all on function public.get_receipt_by_token(uuid) from public;
revoke all on function public.certify_receipt_by_token(uuid) from public;
revoke all on function public.contest_receipt_by_token(uuid, text, integer, text) from public;

grant execute on function public.get_receipt_by_token(uuid) to anon, authenticated;
grant execute on function public.certify_receipt_by_token(uuid) to anon, authenticated;
grant execute on function public.contest_receipt_by_token(uuid, text, integer, text) to anon, authenticated;

COMMIT;
