-- #167 Phase 1 — Idempotence des écritures critiques (terrain réseau instable).
--
-- Problème : si un POST part mais que la réponse se perd, le propriétaire
-- re-soumet. record_collection re-créait alors une DEUXIÈME réception (double
-- encaissement — faute d'intégrité pour un ledger), et bulk_onboard_portfolio
-- échouait en 23505 (nom de logement déjà pris) sans dire que le premier envoi
-- avait réussi. confirm_collection et generate_receipt_core sont déjà
-- idempotentes (no-op / early-return) : ce fichier ferme les deux maillons
-- restants.
--
-- Mécanisme : le client génère une clé UUID par formulaire (champ caché) ; la
-- RPC la « revendique » en tout début de transaction dans
-- public.idempotency_keys (PK landlord+scope+key). Rejeu du même envoi :
--   - après commit du premier → conflit PK → on renvoie le résultat archivé
--     (même reception_id / même récap), zéro double écriture ;
--   - pendant le premier (concurrent) → l'insert bloque sur la PK jusqu'au
--     commit, puis conflit → même chemin ;
--   - après échec du premier → la revendication a été rollbackée avec lui →
--     la clé est réutilisable (une correction re-soumise passe).
--
-- Signatures : ajout de p_request_id uuid default null EN FIN de signature —
-- et suppression des anciennes signatures dans la même migration (leçon
-- surcharges ambiguës : jamais deux signatures qui coexistent). Les appelants
-- existants (ops_record_collection à 10 args, webhook) restent valides via le
-- défaut. Compatible ascendant : l'app déployée avant cette migration n'envoie
-- pas p_request_id.

begin;

-- -----------------------------------------------------------------------------
-- 1. Table des clés d'idempotence
-- -----------------------------------------------------------------------------
create table if not exists public.idempotency_keys (
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  scope text not null check (scope in ('record_collection', 'bulk_onboard')),
  key uuid not null,
  -- null = revendiquée (transaction en cours) ; rempli au commit du résultat.
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (landlord_id, scope, key)
);

alter table public.idempotency_keys enable row level security;

drop policy if exists "Landlords manage own idempotency keys" on public.idempotency_keys;
create policy "Landlords manage own idempotency keys" on public.idempotency_keys
  for all
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

-- Policy sans GRANT = table invisible (leçon 20260705130000).
grant select, insert, update on public.idempotency_keys to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Cœur record_collection : + p_request_id (rejeu → même réception)
--    Corps identique à 20260714120000 ; ajouts = revendication de la clé en
--    tête et archivage du résultat en fin.
-- -----------------------------------------------------------------------------
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
  p_reference text default null,
  p_request_id uuid default null
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

  -- Idempotence (#167) : revendiquer la clé AVANT tout travail. Un rejeu
  -- concurrent bloque ici jusqu'au commit du premier, puis renvoie son résultat.
  if p_request_id is not null then
    begin
      insert into public.idempotency_keys (landlord_id, scope, key)
      values (lid, 'record_collection', p_request_id);
    exception when unique_violation then
      select (k.result->>'reception_id')::uuid into rid
      from public.idempotency_keys k
      where k.landlord_id = lid and k.scope = 'record_collection' and k.key = p_request_id;
      if rid is null then
        -- Clé revendiquée sans résultat archivé : impossible en fonctionnement
        -- normal (même transaction) — on refuse plutôt que de doubler.
        raise exception 'DUPLICATE_PAYMENT' using errcode = 'P0001';
      end if;
      return rid;
    end;
  end if;

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

  -- Idempotence (#167) : archiver le résultat sous la clé revendiquée — même
  -- transaction, donc rejoué atomiquement avec les écritures métier.
  if p_request_id is not null then
    update public.idempotency_keys
    set result = jsonb_build_object('reception_id', rid)
    where landlord_id = lid and scope = 'record_collection' and key = p_request_id;
  end if;

  return rid;
end;
$function$;

-- Ancienne signature 11 args supprimée (défaut de p_request_id couvre les
-- appels existants à 10/11 arguments : ops_record_collection, rail PSP).
drop function if exists private.record_collection_core(
  uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text, text, text
);

grant execute on function private.record_collection_core(
  uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text, text, text, uuid
) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Wrapper public record_collection : expose p_request_id
-- -----------------------------------------------------------------------------
create or replace function public.record_collection(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_amount integer,
  p_method text,
  p_received_at timestamp with time zone,
  p_note text,
  p_allocations jsonb,
  p_reference text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
begin
  return private.record_collection_core(
    private.current_landlord_id(),
    p_tenant_id, p_unit_id, p_amount, p_method, p_received_at, p_note,
    p_allocations, 'landlord', null, p_reference, p_request_id
  );
end;
$function$;

drop function if exists public.record_collection(
  uuid, uuid, integer, text, timestamptz, text, jsonb, text
);

revoke all on function public.record_collection(
  uuid, uuid, integer, text, timestamptz, text, jsonb, text, uuid
) from public, anon;
grant execute on function public.record_collection(
  uuid, uuid, integer, text, timestamptz, text, jsonb, text, uuid
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. bulk_onboard_portfolio : + p_request_id (rejeu → même récap, zéro doublon)
--    Corps identique à 20260715190000 ; ajouts = revendication + archivage.
-- -----------------------------------------------------------------------------
create or replace function public.bulk_onboard_portfolio(
  p_property jsonb,
  p_rows jsonb,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_landlord uuid;
  v_prop uuid;
  v_prop_id uuid;
  elem jsonb;
  idx int;
  v_unit uuid;
  v_tenant uuid;
  v_lease uuid;
  v_units int := 0;
  v_tenants int := 0;
  v_leases int := 0;
  v_lease_ids uuid[] := '{}';
  v_dues int := 0;
  v_state text;
  v_msg text;
  v_result jsonb;
begin
  v_landlord := private.current_landlord_id();
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;

  -- Idempotence (#167) : revendiquer la clé avant tout travail.
  if p_request_id is not null then
    begin
      insert into public.idempotency_keys (landlord_id, scope, key)
      values (v_landlord, 'bulk_onboard', p_request_id);
    exception when unique_violation then
      select k.result into v_result
      from public.idempotency_keys k
      where k.landlord_id = v_landlord and k.scope = 'bulk_onboard' and k.key = p_request_id;
      if v_result is null then
        raise exception 'no_rows' using errcode = 'P0001';
      end if;
      return v_result;
    end;
  end if;

  -- Résolution du lieu : id existant possédé, OU création inline (ADR-020).
  if p_property is null or jsonb_typeof(p_property) <> 'object' then
    raise exception 'property_invalid' using errcode = 'P0001';
  end if;

  v_prop_id := nullif(btrim(p_property->>'id'), '')::uuid;

  if v_prop_id is not null then
    select id into v_prop
    from public.properties
    where id = v_prop_id
      and landlord_id = v_landlord
      and deleted_at is null;

    if v_prop is null then
      raise exception 'property_not_found' using errcode = 'P0002';
    end if;
  else
    if coalesce(btrim(p_property->>'name'), '') = '' then
      raise exception 'property_name_required' using errcode = 'P0001';
    end if;

    insert into public.properties (landlord_id, name, city, address, notes)
    values (
      v_landlord,
      btrim(p_property->>'name'),
      nullif(btrim(p_property->>'city'), ''),
      nullif(btrim(p_property->>'address'), ''),
      nullif(btrim(p_property->>'notes'), '')
    )
    returning id into v_prop;
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 then
    raise exception 'no_rows' using errcode = 'P0001';
  end if;

  for elem, idx in
    select value, ordinality
    from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      -- Logement: always created.
      insert into public.units (
        landlord_id, property_id, name, unit_type, availability_status, notes
      )
      values (
        v_landlord,
        v_prop,
        elem->>'unit_name',
        elem->>'unit_type',
        case when (elem->>'first_name') is not null then 'occupied' else 'available' end,
        elem->>'unit_notes'
      )
      returning id into v_unit;
      v_units := v_units + 1;

      -- Locataire + bail activé: only when the tenant block is present.
      if (elem->>'first_name') is not null then
        insert into public.tenants (
          landlord_id, first_name, last_name, phone, email, notes
        )
        values (
          v_landlord,
          elem->>'first_name',
          elem->>'last_name',
          elem->>'phone',
          elem->>'email',
          elem->>'tenant_notes'
        )
        returning id into v_tenant;
        v_tenants := v_tenants + 1;

        insert into public.leases (
          landlord_id, unit_id, tenant_id, monthly_rent_amount, currency,
          due_day, start_date, end_date, status, notes
        )
        values (
          v_landlord,
          v_unit,
          v_tenant,
          (elem->>'monthly_rent_amount')::int,
          coalesce(nullif(elem->>'currency', ''), 'XOF'),
          (elem->>'due_day')::int,
          (elem->>'start_date')::date,
          nullif(elem->>'end_date', '')::date,
          'draft',
          elem->>'lease_notes'
        )
        returning id into v_lease;

        -- Reuse the tested activation: draft -> active (no-overlap exclusion)
        -- + generate_rent_dues (ADR-004), atomically.
        perform public.activate_lease(v_lease);
        v_leases := v_leases + 1;
        v_lease_ids := array_append(v_lease_ids, v_lease);
      end if;
    exception
      when others then
        get stacked diagnostics
          v_state = returned_sqlstate,
          v_msg = message_text;
        raise exception 'row %: %', idx, v_msg using errcode = v_state;
    end;
  end loop;

  if array_length(v_lease_ids, 1) is not null then
    select count(*) into v_dues
    from public.rent_dues
    where lease_id = any(v_lease_ids);
  end if;

  v_result := jsonb_build_object(
    'property_id', v_prop,
    'lease_ids', to_jsonb(v_lease_ids),
    'units', v_units,
    'tenants', v_tenants,
    'leases', v_leases,
    'dues', v_dues
  );

  -- Idempotence (#167) : archiver le récap sous la clé — même transaction.
  if p_request_id is not null then
    update public.idempotency_keys
    set result = v_result
    where landlord_id = v_landlord and scope = 'bulk_onboard' and key = p_request_id;
  end if;

  return v_result;
end;
$$;

drop function if exists public.bulk_onboard_portfolio(jsonb, jsonb);

revoke all on function public.bulk_onboard_portfolio(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.bulk_onboard_portfolio(jsonb, jsonb, uuid) to authenticated;

commit;
