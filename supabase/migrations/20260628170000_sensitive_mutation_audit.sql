-- ADR-006 — Audit des mutations sensibles.
-- Principe : l'audit est transactionnel, fail-closed et append-only côté utilisateur.
--
-- Couverture DB :
--   - generate_rent_dues  -> INSERT rent_dues
--   - cancel_rent_due     -> UPDATE rent_dues status -> cancelled
--   - confirm_collection  -> UPDATE rent_receptions status -> confirmed
--   - cancel_collection   -> UPDATE rent_receptions status -> cancelled
--   - generate_receipt    -> INSERT receipts status issued
--   - cancel_receipt      -> UPDATE receipts status -> cancelled
--   - replace_receipt     -> UPDATE receipts.replaces_receipt_id
--   - archive*            -> UPDATE deleted_at null -> not null
--
-- Les triggers exécutent l'insert audit_logs dans la même transaction que la mutation.
-- Si l'audit échoue, la mutation échoue aussi.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- 1. Verrouillage des écritures directes audit_logs côté client.
-- ---------------------------------------------------------------------------

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
drop policy if exists "audit_logs_update_own" on public.audit_logs;
drop policy if exists "audit_logs_delete_own" on public.audit_logs;

revoke insert, update, delete on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fonction standard d'audit.
-- ---------------------------------------------------------------------------

create or replace function private.write_audit(
  p_landlord_id uuid,
  p_actor_landlord_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid;
  v_metadata jsonb;
begin
  if p_landlord_id is null then
    raise exception 'audit_landlord_required' using errcode = 'P0001';
  end if;
  if p_action is null or btrim(p_action) = '' then
    raise exception 'audit_action_required' using errcode = 'P0001';
  end if;
  if p_entity_type is null or btrim(p_entity_type) = '' then
    raise exception 'audit_entity_type_required' using errcode = 'P0001';
  end if;

  v_actor := coalesce(p_actor_landlord_id, private.current_landlord_id());
  v_metadata := jsonb_strip_nulls(
    jsonb_build_object(
      'source', 'db_trigger',
      'actor_id', v_actor,
      'entity', p_entity_type
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  insert into public.audit_logs (
    landlord_id,
    actor_landlord_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_landlord_id,
    v_actor,
    p_action,
    p_entity_type,
    p_entity_id,
    v_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.write_audit(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Audit rent_dues : génération + annulation.
-- ---------------------------------------------------------------------------

create or replace function private.audit_rent_dues_sensitive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit(
      new.landlord_id,
      null,
      'generate_rent_dues',
      'rent_dues',
      new.id,
      jsonb_build_object(
        'after', jsonb_build_object(
          'lease_id', new.lease_id,
          'unit_id', new.unit_id,
          'tenant_id', new.tenant_id,
          'period_start', new.period_start,
          'period_end', new.period_end,
          'due_date', new.due_date,
          'amount_due', new.amount_due,
          'currency', new.currency,
          'status', new.status
        )
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'cancelled' then
    perform private.write_audit(
      new.landlord_id,
      null,
      'cancel_rent_due',
      'rent_dues',
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('status', old.status, 'cancelled_reason', old.cancelled_reason),
        'after', jsonb_build_object('status', new.status, 'cancelled_reason', new.cancelled_reason),
        'reason', new.cancelled_reason
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_rent_dues_sensitive on public.rent_dues;
create trigger trg_audit_rent_dues_sensitive
  after insert or update of status, cancelled_reason on public.rent_dues
  for each row execute function private.audit_rent_dues_sensitive();

-- ---------------------------------------------------------------------------
-- 4. Audit rent_receptions : confirmation + annulation.
-- ---------------------------------------------------------------------------

create or replace function private.audit_rent_receptions_sensitive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'confirmed' then
    perform private.write_audit(
      new.landlord_id,
      null,
      'confirm_collection',
      'rent_receptions',
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('status', old.status, 'confirmed_at', old.confirmed_at),
        'after', jsonb_build_object('status', new.status, 'confirmed_at', new.confirmed_at),
        'amount_received', new.amount_received,
        'currency', new.currency,
        'payment_method', new.payment_method
      )
    );
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'cancelled' then
    perform private.write_audit(
      new.landlord_id,
      null,
      'cancel_collection',
      'rent_receptions',
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('status', old.status, 'cancelled_at', old.cancelled_at),
        'after', jsonb_build_object('status', new.status, 'cancelled_at', new.cancelled_at),
        'reason', new.cancellation_reason,
        'amount_received', new.amount_received,
        'currency', new.currency
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_rent_receptions_sensitive on public.rent_receptions;
create trigger trg_audit_rent_receptions_sensitive
  after update of status, confirmed_at, cancelled_at, cancellation_reason on public.rent_receptions
  for each row execute function private.audit_rent_receptions_sensitive();

-- ---------------------------------------------------------------------------
-- 5. Audit receipts : génération, annulation, remplacement.
-- ---------------------------------------------------------------------------

create or replace function private.audit_receipts_sensitive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and new.status = 'issued'
     and new.deleted_at is null then
    perform private.write_audit(
      new.landlord_id,
      null,
      'generate_receipt',
      'receipts',
      new.id,
      jsonb_build_object(
        'after', jsonb_build_object(
          'rent_reception_id', new.rent_reception_id,
          'receipt_number', new.receipt_number,
          'total_amount', new.total_amount,
          'currency', new.currency,
          'status', new.status,
          'kind', new.kind,
          'issued_at', new.issued_at
        )
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'cancelled' then
    perform private.write_audit(
      new.landlord_id,
      null,
      'cancel_receipt',
      'receipts',
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('status', old.status, 'cancelled_at', old.cancelled_at),
        'after', jsonb_build_object('status', new.status, 'cancelled_at', new.cancelled_at),
        'reason', new.cancellation_reason,
        'rent_reception_id', new.rent_reception_id,
        'receipt_number', new.receipt_number
      )
    );
  end if;

  if tg_op = 'UPDATE'
     and old.replaces_receipt_id is null
     and new.replaces_receipt_id is not null then
    perform private.write_audit(
      new.landlord_id,
      null,
      'replace_receipt',
      'receipts',
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('replaces_receipt_id', old.replaces_receipt_id),
        'after', jsonb_build_object('replaces_receipt_id', new.replaces_receipt_id),
        'replacement_of', new.replaces_receipt_id,
        'rent_reception_id', new.rent_reception_id,
        'receipt_number', new.receipt_number
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_receipts_sensitive on public.receipts;
create trigger trg_audit_receipts_sensitive
  after insert or update of status, cancelled_at, cancellation_reason, replaces_receipt_id on public.receipts
  for each row execute function private.audit_receipts_sensitive();

-- ---------------------------------------------------------------------------
-- 6. Audit archive* : soft delete / archive par deleted_at.
-- ---------------------------------------------------------------------------

create or replace function private.audit_soft_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.deleted_at is null
     and new.deleted_at is not null then
    perform private.write_audit(
      new.landlord_id,
      null,
      'archive_' || tg_table_name,
      tg_table_name,
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('deleted_at', old.deleted_at),
        'after', jsonb_build_object('deleted_at', new.deleted_at)
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_properties_archive on public.properties;
create trigger trg_audit_properties_archive
  after update of deleted_at on public.properties
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_units_archive on public.units;
create trigger trg_audit_units_archive
  after update of deleted_at on public.units
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_tenants_archive on public.tenants;
create trigger trg_audit_tenants_archive
  after update of deleted_at on public.tenants
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_leases_archive on public.leases;
create trigger trg_audit_leases_archive
  after update of deleted_at on public.leases
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_rent_dues_archive on public.rent_dues;
create trigger trg_audit_rent_dues_archive
  after update of deleted_at on public.rent_dues
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_rent_receptions_archive on public.rent_receptions;
create trigger trg_audit_rent_receptions_archive
  after update of deleted_at on public.rent_receptions
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_payment_proofs_archive on public.payment_proofs;
create trigger trg_audit_payment_proofs_archive
  after update of deleted_at on public.payment_proofs
  for each row execute function private.audit_soft_archive();

drop trigger if exists trg_audit_receipts_archive on public.receipts;
create trigger trg_audit_receipts_archive
  after update of deleted_at on public.receipts
  for each row execute function private.audit_soft_archive();
