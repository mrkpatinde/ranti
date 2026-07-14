-- ADR-018 (v3) — Cœur transactionnel PSP : ledger payment_transactions.
--
-- Règle métier :
--   * Cash-in : le locataire paie exactement 100 % du loyer via le PSP agréé
--     (reco : FedaPay — voir comparatif ADR-018). Les fonds vivent dans le
--     wallet marchand chez le PSP : Ranti = interface, jamais détenteur.
--   * Frais : 3,0 % total prélevés sur le brut = frais PSP (180 bp défaut)
--     + commission Ranti (120 bp défaut). Taux STOCKÉS sur chaque ligne
--     (configurables sans invalider l'historique ni les CHECKs) ; à
--     verrouiller à la signature du contrat PSP.
--   * Cash-out : net_amount = montant − psp_fee − platform_fee (97 %),
--     reversé au propriétaire via l'API payout du PSP (FedaPay : 0 F).
--
-- Principes :
--   * Montants FCFA entiers (jamais de flottants). floor(montant × bp / 10000) ;
--     net par soustraction → la ligne balance toujours (CHECKs inviolables).
--   * Machine à états : pending → verified → paid_out ; rejected terminal
--     depuis pending. Un montant inattendu est enregistré 'rejected', jamais
--     droppé (complétude du ledger).
--   * Le webhook INGÈRE seulement (service_role). La validation est celle du
--     PROPRIÉTAIRE (ADR-017) : verify_payment_transaction est accordée à
--     authenticated avec garde d'appartenance explicite.
--   * Aucune voie d'écriture parallèle : verify passe par
--     record_collection_core → confirm_collection_core → generate_receipt_core.

begin;

-- -----------------------------------------------------------------------------
-- 1. Calcul de la commission — miroir exact de apps/web/src/lib/payments/fees.ts.
-- -----------------------------------------------------------------------------

create or replace function private.compute_payment_fees(
  p_amount integer,
  p_psp_bp integer,
  p_platform_bp integer
)
returns table (psp_fee integer, platform_fee integer, net_amount integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_psp integer;
  v_platform integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;
  if p_psp_bp is null or p_psp_bp < 0 or p_platform_bp is null or p_platform_bp < 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;

  -- Division entière Postgres sur positifs = floor, comme Math.floor côté TS.
  v_psp := (p_amount * p_psp_bp) / 10000;
  v_platform := (p_amount * p_platform_bp) / 10000;

  return query select v_psp, v_platform, p_amount - v_psp - v_platform;
end;
$$;

revoke all on function private.compute_payment_fees(integer, integer, integer)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Ledger
-- -----------------------------------------------------------------------------

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id),
  lease_id uuid not null references public.leases(id),
  provider text not null default 'fedapay'
    check (provider in ('fedapay', 'feexpay', 'kkiapay')),
  provider_reference text not null
    check (length(btrim(provider_reference)) > 0),
  amount_received integer not null check (amount_received > 0),
  psp_fee_bp integer not null default 180 check (psp_fee_bp >= 0),
  platform_fee_bp integer not null default 120 check (platform_fee_bp >= 0),
  psp_fee integer not null,
  platform_fee integer not null,
  net_amount integer not null check (net_amount >= 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'paid_out', 'rejected')),
  rejection_reason text,
  rent_reception_id uuid references public.rent_receptions(id),
  payload jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  paid_out_at timestamptz,
  -- Le ledger balance par construction : impossible à violer même par une RPC boguée.
  constraint payment_transactions_psp_fee_check
    check (psp_fee = (amount_received * psp_fee_bp) / 10000),
  constraint payment_transactions_platform_fee_check
    check (platform_fee = (amount_received * platform_fee_bp) / 10000),
  constraint payment_transactions_net_check
    check (net_amount = amount_received - psp_fee - platform_fee),
  constraint payment_transactions_provider_ref_uq
    unique (provider, provider_reference),
  constraint payment_transactions_verified_has_reception
    check (status not in ('verified', 'paid_out') or rent_reception_id is not null),
  constraint payment_transactions_paid_out_has_timestamp
    check ((status = 'paid_out') = (paid_out_at is not null))
);

create index payment_transactions_landlord_idx on public.payment_transactions (landlord_id);
create index payment_transactions_lease_idx on public.payment_transactions (lease_id);
create index payment_transactions_status_idx on public.payment_transactions (status);
create index payment_transactions_created_idx on public.payment_transactions (created_at desc);

-- RLS + grants explicites (leçon revue 2026-07-05 : policy sans GRANT = invisible,
-- et les tests SQL en postgres ne le voient pas — assertions dédiées dans
-- supabase/tests/payment_transactions.test.sql).
alter table public.payment_transactions enable row level security;

create policy payment_transactions_select_own on public.payment_transactions
  for select using (landlord_id = private.current_landlord_id());

revoke all on table public.payment_transactions from public, anon, authenticated;
grant select on table public.payment_transactions to authenticated;
-- Aucun grant INSERT/UPDATE/DELETE client : les RPC definer sont la seule voie d'écriture.

create trigger payment_transactions_audit
after insert or update on public.payment_transactions
for each row execute function private.log_audit();

-- -----------------------------------------------------------------------------
-- 3. recorded_by = 'psp' (rail vérifié) : contrainte table + garde du cœur.
-- -----------------------------------------------------------------------------

alter table public.rent_receptions
  drop constraint rent_receptions_recorded_by_check;
alter table public.rent_receptions
  add constraint rent_receptions_recorded_by_check
  check (recorded_by in ('landlord', 'operator', 'tenant', 'psp'));

-- Corps identique à 20260711150000 ; seul changement : 'psp' accepté dans la
-- garde p_recorded_by (le rail PSP écrit via verify_payment_transaction).
create or replace function private.record_collection_core(
  p_landlord_id uuid,
  p_tenant_id uuid,
  p_unit_id uuid,
  p_amount integer,
  p_method text,
  p_received_at timestamp with time zone,
  p_note text,
  p_allocations jsonb,
  p_recorded_by text,
  p_recorded_by_ref text,
  p_reference text default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  lid uuid := p_landlord_id;
  rid uuid;
  alloc_sum integer := 0;
  a jsonb;
  amt integer;
  due public.rent_dues;
  paid_already integer;
  has_allocations boolean;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_invalid' using errcode = 'P0001'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'other') then
    raise exception 'method_invalid' using errcode = 'P0001';
  end if;
  if p_recorded_by not in ('landlord', 'operator', 'psp') then
    raise exception 'recorded_by_invalid' using errcode = 'P0001';
  end if;

  has_allocations := jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) > 0;

  perform 1 from public.tenants where id = p_tenant_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'tenant_not_found' using errcode = 'P0002'; end if;

  perform 1 from public.units where id = p_unit_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'unit_not_found' using errcode = 'P0002'; end if;

  -- Chemin alloué (formulaire) : validation inchangée. Chemin fast-log
  -- (allocations vides) : on saute entièrement la validation d'échéance.
  if has_allocations then
    for a in select * from jsonb_array_elements(p_allocations)
    loop
      amt := (a->>'amount_allocated')::int;
      if amt is null or amt <= 0 then raise exception 'allocation_invalid' using errcode = 'P0001'; end if;

      select * into due from public.rent_dues
      where id = (a->>'rent_due_id')::uuid and landlord_id = lid and deleted_at is null;
      if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
      if due.tenant_id <> p_tenant_id then raise exception 'due_tenant_mismatch' using errcode = 'P0001'; end if;
      if due.unit_id <> p_unit_id then raise exception 'due_unit_mismatch' using errcode = 'P0001'; end if;
      if due.status = 'cancelled' then raise exception 'due_cancelled' using errcode = 'P0001'; end if;

      select coalesce(sum(al.amount_allocated), 0) into paid_already
      from public.rent_reception_allocations al
      join public.rent_receptions r on r.id = al.rent_reception_id
      where al.rent_due_id = due.id
        and r.status = 'confirmed'
        and r.deleted_at is null;

      if amt > (due.amount_due - paid_already) then
        raise exception 'allocation_exceeds_due' using errcode = 'P0001';
      end if;

      alloc_sum := alloc_sum + amt;
    end loop;

    if alloc_sum > p_amount then
      raise exception 'allocations_exceed_amount' using errcode = 'P0001';
    end if;
  end if;

  -- Insertion + déduplication : une même payment_reference (par propriétaire)
  -- lève 23505 → on renvoie une erreur métier dédiée que le client intercepte.
  begin
    insert into public.rent_receptions (
      landlord_id, tenant_id, unit_id, received_at, amount_received, currency,
      payment_method, status, note, recorded_by, recorded_by_ref, payment_reference
    )
    values (
      lid, p_tenant_id, p_unit_id, coalesce(p_received_at, now()), p_amount, 'XOF',
      p_method, 'draft', p_note, p_recorded_by, p_recorded_by_ref, p_reference
    )
    returning id into rid;
  exception when unique_violation then
    raise exception 'DUPLICATE_PAYMENT' using errcode = 'P0001';
  end;

  if has_allocations then
    insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
    select lid, rid, (el->>'rent_due_id')::uuid, (el->>'amount_allocated')::int
    from jsonb_array_elements(p_allocations) as el;
  end if;

  return rid;
end;
$function$;

-- La surcharge 10 args (20260703230000) coexistait avec le cœur 11 args
-- (p_reference default null, 20260711150000) : tout appel à 10 arguments
-- (wrapper legacy record_collection 7 args, ops_record_collection) était
-- ambigu — "could not choose a best candidate function". On la supprime :
-- le défaut de p_reference couvre les appels à 10 arguments.
drop function if exists private.record_collection_core(
  uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text, text
);

-- -----------------------------------------------------------------------------
-- 4. RPC d'ingestion (webhook, service_role) — idempotente, INGÈRE SEULEMENT.
-- -----------------------------------------------------------------------------

create function public.ingest_payment_notification(
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
  v_fees record;
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

  select * into v_fees from private.compute_payment_fees(p_amount, 180, 120);

  begin
    insert into public.payment_transactions (
      landlord_id, lease_id, provider, provider_reference,
      amount_received, psp_fee_bp, platform_fee_bp,
      psp_fee, platform_fee, net_amount,
      status, rejection_reason, payload
    )
    values (
      v_lease.landlord_id, v_lease.id, p_provider, btrim(p_reference),
      p_amount, 180, 120,
      v_fees.psp_fee, v_fees.platform_fee, v_fees.net_amount,
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

-- -----------------------------------------------------------------------------
-- 5. Vérification PAR LE PROPRIÉTAIRE — flip du ledger + pipeline, atomique.
--    SECURITY DEFINER (la table n'a pas de grant d'écriture client) mais
--    accordée à authenticated avec garde d'appartenance explicite
--    (précédent : RPC token ADR-013). P0002 volontaire si la transaction
--    n'appartient pas au propriétaire : ne divulgue pas son existence.
-- -----------------------------------------------------------------------------

create function public.verify_payment_transaction(
  p_transaction_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.payment_transactions;
  v_lease public.leases;
  v_due record;
  v_paid integer;
  v_allocations jsonb := '[]'::jsonb;
  v_reception uuid;
begin
  select * into v_tx from public.payment_transactions
  where id = p_transaction_id
    and landlord_id = private.current_landlord_id()
  for update;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;
  if v_tx.status <> 'pending' then
    raise exception 'transaction_not_pending' using errcode = 'P0001';
  end if;

  -- Re-vérification au moment du verify (le bail a pu bouger depuis l'ingestion).
  select * into v_lease from public.leases
  where id = v_tx.lease_id and deleted_at is null;
  if not found or v_lease.status <> 'active' then
    update public.payment_transactions
    set status = 'rejected', rejection_reason = 'lease_not_active'
    where id = v_tx.id;
    return null;
  end if;
  if v_tx.amount_received <> v_lease.monthly_rent_amount then
    update public.payment_transactions
    set status = 'rejected', rejection_reason = 'amount_mismatch'
    where id = v_tx.id;
    return null;
  end if;

  -- Allocation : la plus ancienne échéance ouverte du bail, seulement si son
  -- reste dû égale exactement le montant. Sinon crédit non affecté (ADR-014),
  -- alloué plus tard depuis le journal.
  select d.id, d.amount_due into v_due
  from public.rent_dues d
  where d.lease_id = v_lease.id
    and d.deleted_at is null
    and d.status in ('expected', 'overdue')
  order by d.due_date asc
  limit 1;

  if found then
    select coalesce(sum(al.amount_allocated), 0) into v_paid
    from public.rent_reception_allocations al
    join public.rent_receptions r on r.id = al.rent_reception_id
    where al.rent_due_id = v_due.id
      and r.status = 'confirmed'
      and r.deleted_at is null;

    if (v_due.amount_due - v_paid) = v_tx.amount_received then
      v_allocations := jsonb_build_array(jsonb_build_object(
        'rent_due_id', v_due.id,
        'amount_allocated', v_tx.amount_received
      ));
    end if;
  end if;

  -- Pipeline existant, montant BRUT (la quittance certifie ce que le locataire
  -- a payé ; commission/net ne vivent que sur le ledger). La référence PSP
  -- alimente payment_reference → déduplication cross-rail avec le collage SMS :
  -- si la référence est déjà prise, DUPLICATE_PAYMENT remonte et la transaction
  -- reste 'pending' (jamais 'verified' sans réception).
  v_reception := private.record_collection_core(
    v_tx.landlord_id,
    v_lease.tenant_id,
    v_lease.unit_id,
    v_tx.amount_received,
    'mobile_money',
    now(),
    'Paiement ' || v_tx.provider || ' validé par le propriétaire',
    v_allocations,
    'psp',
    v_tx.provider,
    v_tx.provider_reference
  );

  -- ADR-007 : la validation du propriétaire déclenche confirmation + document,
  -- dans la même transaction Postgres.
  perform private.confirm_collection_core(v_tx.landlord_id, v_reception);
  perform private.generate_receipt_core(v_tx.landlord_id, v_reception);

  update public.payment_transactions
  set status = 'verified', verified_at = now(), rent_reception_id = v_reception
  where id = v_tx.id;

  return v_reception;
end;
$$;

revoke all on function public.verify_payment_transaction(uuid)
  from public, anon;
grant execute on function public.verify_payment_transaction(uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Rejet explicite (ops) + reversement effectué (ops).
-- -----------------------------------------------------------------------------

create function public.reject_payment_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.payment_transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'pending' then
    raise exception 'transaction_not_pending' using errcode = 'P0001';
  end if;

  update public.payment_transactions
  set status = 'rejected', rejection_reason = coalesce(nullif(btrim(p_reason), ''), 'rejected')
  where id = p_transaction_id;
end;
$$;

revoke all on function public.reject_payment_transaction(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reject_payment_transaction(uuid, text)
  to service_role;

create function public.mark_payment_transaction_paid_out(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.payment_transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'verified' then
    raise exception 'payout_not_applicable' using errcode = 'P0001';
  end if;

  update public.payment_transactions
  set status = 'paid_out', paid_out_at = now()
  where id = p_transaction_id;
end;
$$;

revoke all on function public.mark_payment_transaction_paid_out(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_payment_transaction_paid_out(uuid)
  to service_role;

commit;
