-- ADR-018 v4 — Split fiscal de la commission « All-Inclusive 5 % ».
--
-- La commission montrée au propriétaire (service_fee) est TTC. Pour la
-- comptabilité et la fiscalité béninoises, chaque ligne archive sa
-- décomposition : commission_ht + tva_amount = service_fee, au taux de TVA
-- en vigueur (18 % = 1800 bp), archivé par ligne comme les autres taux —
-- un changement de taux légal ne casse ni l'historique ni les CHECKs.
--
-- Arithmétique : entiers XOF uniquement, jamais de flottants.
--   commission_ht = floor(service_fee × 10000 / (10000 + tva_rate_bp))
--   tva_amount    = service_fee − commission_ht
-- Floor sur le HT ⇒ la TVA absorbe le reste (arrondi vers le haut) : la TVA
-- déclarée n'est jamais sous-évaluée, et la somme balance par construction.
--
-- Visibilité : vision COMPTA — invisible du propriétaire (grants par
-- colonne : on n'étend PAS le grant SELECT de authenticated ; service_role
-- lit via son grant TABLE explicite, qui couvre les nouvelles colonnes).

begin;

-- -----------------------------------------------------------------------------
-- 1. Colonnes fiscales + backfill des lignes existantes.
-- -----------------------------------------------------------------------------

alter table public.payment_transactions
  add column tva_rate_bp integer not null default 1800 check (tva_rate_bp >= 0),
  add column commission_ht integer not null default 0,
  add column tva_amount integer not null default 0;

update public.payment_transactions
set commission_ht = ((service_fee::bigint * 10000) / (10000 + tva_rate_bp))::integer,
    tva_amount = service_fee - ((service_fee::bigint * 10000) / (10000 + tva_rate_bp))::integer;

-- Comme service_fee/net_amount : les montants sont calculés par la RPC
-- d'ingestion et verrouillés par les CHECKs — pas de default silencieux.
-- (tva_rate_bp garde son default, comme les autres colonnes de taux.)
alter table public.payment_transactions
  alter column commission_ht drop default,
  alter column tva_amount drop default;

alter table public.payment_transactions
  add constraint payment_transactions_commission_ht_check
    check (commission_ht = ((service_fee::bigint * 10000) / (10000 + tva_rate_bp))::integer),
  add constraint payment_transactions_tva_amount_check
    check (tva_amount = service_fee - commission_ht);

-- -----------------------------------------------------------------------------
-- 2. Calcul — nouvelle signature (p_tva_bp). L'ancienne signature 4 paramètres
--    est supprimée DANS LA MÊME MIGRATION (leçon surcharges ambiguës).
-- -----------------------------------------------------------------------------

drop function if exists private.compute_transaction_details(integer, integer, integer, integer);

create function private.compute_transaction_details(
  p_amount integer,
  p_service_bp integer,
  p_payin_bp integer,
  p_payout_bp integer,
  p_tva_bp integer
)
returns table (
  service_fee integer,
  net_amount integer,
  payin_cost integer,
  payout_cost integer,
  net_margin integer,
  commission_ht integer,
  tva_amount integer
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_service integer;
  v_net integer;
  v_payin integer;
  v_payout integer;
  v_ht integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;
  if p_service_bp is null or p_service_bp < 0
     or p_payin_bp is null or p_payin_bp < 0
     or p_payout_bp is null or p_payout_bp < 0
     or p_tva_bp is null or p_tva_bp < 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;
  -- Un service > 100 % rendrait le net négatif : troncature SQL ≠ Math.floor
  -- sur négatifs — entrée interdite des deux côtés (fees.ts idem).
  if p_service_bp > 10000 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;

  -- Division entière sur positifs = floor, comme Math.floor côté TS.
  v_service := ((p_amount::bigint * p_service_bp) / 10000)::integer;
  v_net := p_amount - v_service;
  v_payin := ((p_amount::bigint * p_payin_bp) / 10000)::integer;
  -- Le coût de payout porte sur le montant effectivement reversé (le net).
  v_payout := ((v_net::bigint * p_payout_bp) / 10000)::integer;
  -- Split fiscal de la commission TTC : floor sur le HT, la TVA absorbe le
  -- reste — HT + TVA = service_fee par construction.
  v_ht := ((v_service::bigint * 10000) / (10000 + p_tva_bp))::integer;

  return query select v_service, v_net, v_payin, v_payout,
                      v_service - v_payin - v_payout,
                      v_ht, v_service - v_ht;
end;
$$;

revoke all on function private.compute_transaction_details(integer, integer, integer, integer, integer)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Ingestion : mêmes gardes, split fiscal archivé sur chaque ligne.
-- -----------------------------------------------------------------------------

create or replace function public.ingest_payment_notification(
  p_provider text,
  p_reference text,
  p_lease_id uuid,
  p_amount integer,
  p_payload jsonb
)
returns table (transaction_id uuid, status text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease public.leases;
  v_d record;
  v_status text;
  v_reason text;
  v_id uuid;
  v_existing_amount integer;
  v_existing_lease uuid;
begin
  if p_provider is null or p_provider not in ('fedapay', 'feexpay', 'kkiapay') then
    raise exception 'provider_invalid' using errcode = 'P0001';
  end if;
  if p_reference is null or length(btrim(p_reference)) = 0 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;

  -- Idempotence : rejouer une notification déjà ingérée n'est PAS une erreur —
  -- mais seulement si elle raconte la MÊME histoire. Une même référence avec
  -- un montant ou un bail différent = divergence amont (PSP qui recycle une
  -- référence, bug, tentative d'empoisonnement) : on refuse bruyamment, la
  -- ligne d'origine fait foi.
  select t.id, t.status, t.amount_received, t.lease_id
    into v_id, v_status, v_existing_amount, v_existing_lease
  from public.payment_transactions t
  where t.provider = p_provider and t.provider_reference = btrim(p_reference);
  if found then
    if v_existing_amount <> p_amount or v_existing_lease is distinct from p_lease_id then
      raise exception 'reference_conflict' using errcode = 'P0001';
    end if;
    return query select v_id, v_status, false;
    return;
  end if;

  select * into v_lease from public.leases
  where id = p_lease_id and deleted_at is null;
  if not found then
    raise exception 'lease_not_found' using errcode = 'P0002';
  end if;

  -- Montant inattendu ou bail inactif : ligne 'rejected', jamais droppée
  -- (complétude du ledger — l'argent a bougé chez le PSP, on doit le tracer).
  if v_lease.status <> 'active' then
    v_status := 'rejected';
    v_reason := 'lease_not_active';
  elsif p_amount <> v_lease.monthly_rent_amount then
    v_status := 'rejected';
    v_reason := 'amount_mismatch';
  else
    v_status := 'pending';
    v_reason := null;
  end if;

  select * into v_d from private.compute_transaction_details(p_amount, 500, 170, 100, 1800);

  begin
    insert into public.payment_transactions (
      landlord_id, lease_id, provider, provider_reference,
      amount_received,
      service_fee_bp, payin_cost_bp, payout_cost_bp, tva_rate_bp,
      service_fee, net_amount, payin_cost, payout_cost, net_margin,
      commission_ht, tva_amount,
      status, rejection_reason, payload
    )
    values (
      v_lease.landlord_id, v_lease.id, p_provider, btrim(p_reference),
      p_amount,
      500, 170, 100, 1800,
      v_d.service_fee, v_d.net_amount, v_d.payin_cost, v_d.payout_cost, v_d.net_margin,
      v_d.commission_ht, v_d.tva_amount,
      v_status, v_reason, p_payload
    )
    returning id into v_id;
  exception when unique_violation then
    -- Course entre deux replays simultanés : l'un a gagné — même règle que
    -- ci-dessus, on ne renvoie sa ligne que si elle raconte la même histoire.
    select t.id, t.status, t.amount_received, t.lease_id
      into v_id, v_status, v_existing_amount, v_existing_lease
    from public.payment_transactions t
    where t.provider = p_provider and t.provider_reference = btrim(p_reference);
    if v_existing_amount <> p_amount or v_existing_lease is distinct from p_lease_id then
      raise exception 'reference_conflict' using errcode = 'P0001';
    end if;
    return query select v_id, v_status, false;
    return;
  end;

  return query select v_id, v_status, true;
end;
$$;

revoke all on function public.ingest_payment_notification(text, text, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_payment_notification(text, text, uuid, integer, jsonb)
  to service_role;

commit;
