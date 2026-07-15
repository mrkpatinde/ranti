-- ADR-018 v4 — Modèle économique « All-Inclusive 5 % ».
--
-- Deux visions sur chaque transaction :
--   * REÇU (propriétaire) : service_fee = 5 % du brut (500 bp), tout compris ;
--     net_amount = brut − service_fee (95 %) reversé au propriétaire.
--   * COMPTABILITÉ (interne) : les frais PSP sont des DÉPENSES de Ranti,
--     invisibles du propriétaire — payin_cost = brut × payin_bp,
--     payout_cost = net × payout_bp (le payout porte sur le montant reversé),
--     net_margin = service_fee − payin_cost − payout_cost.
--     Défauts alignés FeexPay (170 bp payin, 100 bp payout — décision CEO) ;
--     taux ARCHIVÉS par ligne : changer de PSP ou renégocier ne casse ni
--     l'historique ni les CHECKs. net_margin peut devenir négatif si les
--     coûts dépassent la commission — c'est une information, pas une erreur.
--
-- La table est vide en production (activation bloquée par le caveat juridique
-- BCEAO d'ADR-018) : le reshape des colonnes est sans migration de données.

begin;

-- Garde : le reshape suppose une table vide (aucune migration de données).
-- Si l'hypothèse a changé (activation prod entre-temps), échouer clairement
-- plutôt que de laisser un ALTER remplir des colonnes à 0.
do $$
begin
  if exists (select 1 from public.payment_transactions) then
    raise exception 'payment_transactions non vide : le reshape v4 exige une migration de données explicite';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Reshape du ledger : deux composants PSP → vision reçu + vision compta.
-- -----------------------------------------------------------------------------

alter table public.payment_transactions
  drop constraint payment_transactions_psp_fee_check,
  drop constraint payment_transactions_platform_fee_check,
  drop constraint payment_transactions_net_check;

alter table public.payment_transactions
  drop column psp_fee_bp,
  drop column platform_fee_bp,
  drop column psp_fee,
  drop column platform_fee;

alter table public.payment_transactions
  add column service_fee_bp integer not null default 500 check (service_fee_bp >= 0),
  add column service_fee integer not null default 0,
  add column payin_cost_bp integer not null default 170 check (payin_cost_bp >= 0),
  add column payout_cost_bp integer not null default 100 check (payout_cost_bp >= 0),
  add column payin_cost integer not null default 0,
  add column payout_cost integer not null default 0,
  add column net_margin integer not null default 0;

-- Les defaults 0 n'existent que pour le DDL : les valeurs réelles sont posées
-- par la RPC d'ingestion et verrouillées par les CHECKs ci-dessous.
alter table public.payment_transactions
  alter column service_fee drop default,
  alter column payin_cost drop default,
  alter column payout_cost drop default,
  alter column net_margin drop default;

-- Le ledger balance par construction (cast bigint : produit intermédiaire
-- au-delà de ~4,2M FCFA à 500 bp, même règle que la leçon int4 de v3).
alter table public.payment_transactions
  add constraint payment_transactions_service_fee_check
    check (service_fee = ((amount_received::bigint * service_fee_bp) / 10000)::integer),
  add constraint payment_transactions_net_check
    check (net_amount = amount_received - service_fee),
  add constraint payment_transactions_payin_cost_check
    check (payin_cost = ((amount_received::bigint * payin_cost_bp) / 10000)::integer),
  add constraint payment_transactions_payout_cost_check
    check (payout_cost = ((net_amount::bigint * payout_cost_bp) / 10000)::integer),
  add constraint payment_transactions_net_margin_check
    check (net_margin = service_fee - payin_cost - payout_cost);

-- -----------------------------------------------------------------------------
-- 1b. Séparation des deux visions AU NIVEAU BASE (grants par colonne) :
--     le propriétaire (authenticated) ne voit que la vision reçu — jamais les
--     coûts PSP ni la marge de Ranti. La compta interne lit en service_role.
-- -----------------------------------------------------------------------------

revoke select on table public.payment_transactions from authenticated;
grant select (
  id, landlord_id, lease_id, provider, provider_reference,
  amount_received, service_fee_bp, service_fee, net_amount,
  currency, status, rejection_reason, rent_reception_id,
  created_at, verified_at, paid_out_at
) on table public.payment_transactions to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Calcul des deux visions — miroir exact de apps/web/src/lib/payments/fees.ts.
-- -----------------------------------------------------------------------------

drop function if exists private.compute_payment_fees(integer, integer, integer);

create function private.compute_transaction_details(
  p_amount integer,
  p_service_bp integer,
  p_payin_bp integer,
  p_payout_bp integer
)
returns table (
  service_fee integer,
  net_amount integer,
  payin_cost integer,
  payout_cost integer,
  net_margin integer
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
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;
  if p_service_bp is null or p_service_bp < 0
     or p_payin_bp is null or p_payin_bp < 0
     or p_payout_bp is null or p_payout_bp < 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;

  -- Division entière sur positifs = floor, comme Math.floor côté TS.
  v_service := ((p_amount::bigint * p_service_bp) / 10000)::integer;
  v_net := p_amount - v_service;
  v_payin := ((p_amount::bigint * p_payin_bp) / 10000)::integer;
  -- Le coût de payout porte sur le montant effectivement reversé (le net).
  v_payout := ((v_net::bigint * p_payout_bp) / 10000)::integer;

  return query select v_service, v_net, v_payin, v_payout,
                      v_service - v_payin - v_payout;
end;
$$;

revoke all on function private.compute_transaction_details(integer, integer, integer, integer)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Ingestion : mêmes gardes, nouvelles colonnes (500 / 170 / 100 bp).
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

  -- Idempotence : rejouer une notification déjà ingérée n'est PAS une erreur.
  select t.id, t.status into v_id, v_status
  from public.payment_transactions t
  where t.provider = p_provider and t.provider_reference = btrim(p_reference);
  if found then
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

  select * into v_d from private.compute_transaction_details(p_amount, 500, 170, 100);

  begin
    insert into public.payment_transactions (
      landlord_id, lease_id, provider, provider_reference,
      amount_received,
      service_fee_bp, payin_cost_bp, payout_cost_bp,
      service_fee, net_amount, payin_cost, payout_cost, net_margin,
      status, rejection_reason, payload
    )
    values (
      v_lease.landlord_id, v_lease.id, p_provider, btrim(p_reference),
      p_amount,
      500, 170, 100,
      v_d.service_fee, v_d.net_amount, v_d.payin_cost, v_d.payout_cost, v_d.net_margin,
      v_status, v_reason, p_payload
    )
    returning id into v_id;
  exception when unique_violation then
    -- Course entre deux replays simultanés : l'un a gagné, renvoyer sa ligne.
    select t.id, t.status into v_id, v_status
    from public.payment_transactions t
    where t.provider = p_provider and t.provider_reference = btrim(p_reference);
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
