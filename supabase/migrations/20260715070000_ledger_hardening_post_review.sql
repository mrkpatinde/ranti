-- Durcissement du ledger après review du ship v0.2.0.0/v0.3.0.0 (ADR-018 v4).
--
-- 1. GRANT explicite service_role sur payment_transactions : la vision compta
--    « lit en service_role » (migration all_inclusive_5pct) mais aucun grant
--    n'existait — sur un stack aux default privileges durcis, toute lecture
--    compta échouerait en permission denied (classe de bug récurrente
--    « policy correcte + GRANT oublié », cf. 20260714153000).
-- 2. Garde service_bp > 10000 dans compute_transaction_details : au-delà de
--    100 % le net devient négatif et la division entière SQL (troncature vers
--    zéro) diverge de Math.floor côté TS — on interdit l'entrée des deux côtés
--    pour garder le miroir exact sur positifs (fees.ts porte la même garde).
-- 3. Replays divergents dans ingest_payment_notification : un replay portant
--    la même (provider, provider_reference) mais un montant ou un bail
--    DIFFÉRENT n'est plus silencieusement absorbé — il lève
--    'reference_conflict' (le webhook répond en erreur, l'anomalie devient
--    visible ; la ligne d'origine reste intacte). L'idempotence stricte
--    (replay identique) est inchangée. Décision documentée dans ADR-018.
--
-- Rollback : forward-only (pas de down). Le remplacement des deux fonctions
-- est in-place à signature constante (privilèges préservés par CREATE OR
-- REPLACE) ; le grant service_role se révoque d'une ligne si besoin.
-- Ordre migration/deploy : indifférent — aucune colonne ne change, l'ancien
-- code applicatif reste compatible.

begin;

-- -----------------------------------------------------------------------------
-- 1. Vision compta : lecture service_role explicite.
-- -----------------------------------------------------------------------------

grant select on table public.payment_transactions to service_role;

-- -----------------------------------------------------------------------------
-- 2. Garde service_bp > 10000 (miroir exact de fees.ts).
-- -----------------------------------------------------------------------------

create or replace function private.compute_transaction_details(
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

  return query select v_service, v_net, v_payin, v_payout,
                      v_service - v_payin - v_payout;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Ingestion : replay identique idempotent, replay divergent = conflit.
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

commit;
