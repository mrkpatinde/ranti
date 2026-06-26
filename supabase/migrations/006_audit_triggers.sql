-- Ranti audit triggers
-- Target: PostgreSQL 17 / Supabase
-- Scope: trace sensitive mutations in audit_logs via DB triggers.
--
-- audit_logs is not insertable by client roles (see 002/003): audit must be
-- written by trusted code. We use a SECURITY DEFINER trigger so every insert /
-- update / archive on a business table is recorded automatically and cannot be
-- bypassed from the UI (architecture-principles #8, domain rule 6, API invariant:
-- "aucune mutation sensible ne contourne le log d'audit").

-- -----------------------------------------------------------------------------
-- Generic audit writer
-- -----------------------------------------------------------------------------

create or replace function private.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_row jsonb := coalesce(v_new, v_old);
  v_entity_id uuid := (v_row ->> 'id')::uuid;
  -- Every business table carries landlord_id; landlords itself is keyed by id.
  v_landlord uuid := coalesce((v_row ->> 'landlord_id')::uuid, (v_row ->> 'id')::uuid);
  v_action text;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif tg_op = 'UPDATE' then
    if (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_action := 'archived';
    elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
      v_action := 'restored';
    else
      v_action := 'updated';
    end if;

    -- Record changed fields (old/new), excluding bookkeeping noise.
    v_meta := jsonb_build_object(
      'changed',
      coalesce((
        select jsonb_object_agg(key, jsonb_build_object('old', v_old -> key, 'new', v_new -> key))
        from jsonb_each(v_new)
        where (v_new -> key) is distinct from (v_old -> key)
          and key not in ('updated_at')
      ), '{}'::jsonb)
    );
  else
    v_action := 'deleted';
  end if;

  insert into public.audit_logs (
    landlord_id, actor_landlord_id, action, entity_type, entity_id, metadata
  )
  values (
    v_landlord,
    private.current_landlord_id(),
    v_action,
    tg_table_name,
    v_entity_id,
    v_meta
  );

  return null;
end;
$$;

revoke all on function private.log_audit() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Attach to sensitive tables (insert + update; soft-delete is an update)
-- -----------------------------------------------------------------------------

create trigger landlords_audit
after insert or update on public.landlords
for each row execute function private.log_audit();

create trigger properties_audit
after insert or update on public.properties
for each row execute function private.log_audit();

create trigger units_audit
after insert or update on public.units
for each row execute function private.log_audit();

create trigger tenants_audit
after insert or update on public.tenants
for each row execute function private.log_audit();

create trigger leases_audit
after insert or update on public.leases
for each row execute function private.log_audit();

create trigger rent_dues_audit
after insert or update on public.rent_dues
for each row execute function private.log_audit();

create trigger rent_receptions_audit
after insert or update on public.rent_receptions
for each row execute function private.log_audit();

create trigger payment_proofs_audit
after insert or update on public.payment_proofs
for each row execute function private.log_audit();

create trigger receipts_audit
after insert or update on public.receipts
for each row execute function private.log_audit();
