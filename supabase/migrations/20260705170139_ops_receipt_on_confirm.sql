-- ============================================================
-- Fix H1 — l'encaissement opérateur génère aussi la quittance/reçu.
--
-- Problème : ops_confirm_collection (chemin opérateur, service_role) confirmait
--   la réception mais n'appelait jamais generate_receipt. La génération vit dans
--   public.generate_receipt, security invoker sur private.current_landlord_id() :
--   inutilisable en service_role (pas d'auth.uid()). Résultat : tout paiement
--   saisi+confirmé par l'opérateur restait SANS document → le locataire n'avait
--   aucune preuve. Viole ADR-007 (« Ranti génère automatiquement le document
--   adapté après validation »).
--
-- Solution (même découpage que record_collection / confirm_collection) :
--   1. private.generate_receipt_core(p_landlord_id, p_reception_id) : cœur partagé,
--      landlord passé explicitement (checks d'appartenance conservés).
--   2. public.generate_receipt : wrapper mince invoker INCHANGÉ pour le proprio.
--   3. ops_confirm_collection : après confirm, génère le document via le cœur —
--      atomique (ADR-007 « transactionnelle ou cohérente avec la confirmation »),
--      idempotent (early-return du receipt actif existant). Renvoie le receipt id
--      et le trace dans l'audit.
--
-- Idempotent. Aucun changement du chemin proprio.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Cœur partagé (private) — landlord passé explicitement.
--    Corps identique à public.generate_receipt (20260628160000), seule la
--    source du landlord change (param au lieu de current_landlord_id()).
-- ---------------------------------------------------------------------------
create or replace function private.generate_receipt_core(
  p_landlord_id uuid,
  p_reception_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  lid uuid := p_landlord_id;
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

revoke all on function private.generate_receipt_core(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Wrapper proprio (invoker) — comportement inchangé pour l'app propriétaire
--    et pour replace_receipt qui l'appelle.
-- ---------------------------------------------------------------------------
create or replace function public.generate_receipt(p_reception_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.generate_receipt_core(private.current_landlord_id(), p_reception_id);
end;
$$;

revoke all on function public.generate_receipt(uuid) from public, anon;
grant execute on function public.generate_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. ops_confirm_collection : confirme PUIS génère le document, atomiquement.
--    Le type de retour passe de void à uuid → drop obligatoire.
--    ranti-ops ignore la valeur de retour (ne vérifie que l'erreur) : compatible.
-- ---------------------------------------------------------------------------
drop function if exists public.ops_confirm_collection(uuid, uuid, text);

create function public.ops_confirm_collection(
  p_landlord_id uuid, p_reception_id uuid, p_operator text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_receipt uuid;
begin
  perform private.confirm_collection_core(p_landlord_id, p_reception_id);

  -- ADR-007 : document généré automatiquement après validation, dans la même
  -- transaction que la confirmation. Idempotent (receipt actif existant renvoyé).
  v_receipt := private.generate_receipt_core(p_landlord_id, p_reception_id);

  insert into public.audit_logs (landlord_id, actor_landlord_id, action, entity_type, entity_id, metadata)
  values (
    p_landlord_id, null, 'ops.collection_confirmed', 'rent_reception', p_reception_id,
    jsonb_build_object('actor_type', 'operator', 'recorded_by_ref', p_operator, 'receipt_id', v_receipt)
  );

  return v_receipt;
end;
$$;

revoke all on function public.ops_confirm_collection(uuid, uuid, text) from public, anon, authenticated;
-- Grant explicite : le cockpit ranti-ops appelle en service_role (lève l'ambiguïté L1).
grant execute on function public.ops_confirm_collection(uuid, uuid, text) to service_role;

COMMIT;
