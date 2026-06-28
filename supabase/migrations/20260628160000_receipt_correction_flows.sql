-- ADR-005 — Flux de correction quittance / encaissement.
-- Principe : on ne supprime pas l'histoire, on ajoute un evenement correctif.
--   1. Annuler document seul   -> TS cancelReceipt (cascade retiree), inchange ici.
--   2. Annuler encaissement     -> TS cancelCollection, deja explicite/bloque.
--   3. Remplacer document       -> nouvelle RPC transactionnelle replace_receipt.
--
-- Definition stricte "quittance active" = status = 'issued' and deleted_at is null.
-- Preflight verifie (live) : aucun doublon actif par rent_reception_id.

-- ---------------------------------------------------------------------------
-- 1. Lien de remplacement : nouveau document -> ancien document remplace.
-- ---------------------------------------------------------------------------
alter table public.receipts
  add column if not exists replaces_receipt_id uuid references public.receipts(id);

-- ---------------------------------------------------------------------------
-- 2. Remplace l'unicite TOTALE (1 receipt/reception, annules compris) par
--    l'unicite ACTIVE seule : 1 'issued' max + N 'cancelled' en historique.
--    Preflight fail-closed, drop contrainte totale, index partiel. Meme bloc.
-- ---------------------------------------------------------------------------

-- Preflight : refuse la migration si un doublon actif existe deja.
do $$
declare n int;
begin
  select count(*) into n from (
    select rent_reception_id
    from public.receipts
    where status = 'issued' and deleted_at is null
    group by rent_reception_id
    having count(*) > 1
  ) dups;
  if n > 0 then
    raise exception 'preflight: % reception(s) ont plusieurs receipts actifs; corriger avant migration', n
      using errcode = 'P0001';
  end if;
end $$;

-- Drop de l'unicite totale (definie inline dans 001_initial_schema).
alter table public.receipts
  drop constraint if exists receipts_rent_reception_id_key;

-- Unicite active seule. receipts_landlord_id_receipt_number_key reste intacte.
create unique index if not exists uq_receipts_active_per_reception
  on public.receipts (rent_reception_id)
  where status = 'issued' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. generate_receipt : early-return seulement sur un receipt ACTIF.
--    (Avant : renvoyait n'importe quel receipt, meme annule -> remplacement casse.)
-- ---------------------------------------------------------------------------
create or replace function public.generate_receipt(p_reception_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
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

  select 'R-' || lpad((count(*) + 1)::text, 6, '0') into v_num
  from public.receipts where landlord_id = lid;

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
$$;

revoke all on function public.generate_receipt(uuid) from public, anon;
grant execute on function public.generate_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. replace_receipt : flux 3 atomique (annule ancien + genere nouveau + lien).
--    Ne touche jamais l'encaissement. Ne supprime jamais l'ancien.
-- ---------------------------------------------------------------------------
create or replace function public.replace_receipt(p_receipt_id uuid, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  old public.receipts;
  new_id uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  -- Ownership + verrou pour serialiser.
  select * into old from public.receipts
  where id = p_receipt_id and landlord_id = lid and deleted_at is null
  for update;
  if not found then raise exception 'receipt_not_found' using errcode = 'P0002'; end if;
  if old.status <> 'issued' then
    raise exception 'receipt_not_issued' using errcode = 'P0001';
  end if;

  -- Annule l'ancien (historique garde).
  update public.receipts
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = old.id;

  -- Genere le nouveau document actif pour la meme reception.
  -- (l'ancien etant annule, l'early-return ne le renvoie plus.)
  new_id := public.generate_receipt(old.rent_reception_id);

  -- Lien nouveau -> ancien.
  update public.receipts set replaces_receipt_id = old.id where id = new_id;

  -- TODO(ADR-006) : write_audit('receipts','replace', old.id/new_id, {reason}).
  return new_id;
end;
$$;

revoke all on function public.replace_receipt(uuid, text) from public, anon;
grant execute on function public.replace_receipt(uuid, text) to authenticated;
