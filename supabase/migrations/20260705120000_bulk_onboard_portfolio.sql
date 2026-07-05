-- Ranti: bulk onboarding of a landlord's portfolio in one atomic transaction.
-- Target: PostgreSQL 17 / Supabase
--
-- Problem: the single-unit flow is a linear wizard (createUnit -> /tenants/new),
-- so a landlord with several rooms cannot add them in one go. This RPC lets the
-- owner create N logements at once, each optionally with its tenant + activated
-- lease, and lets Ranti generate the rent dues -- reusing the existing, tested
-- activate_lease / generate_rent_dues (domain 002, ADR-004).
--
-- SECURITY INVOKER: RLS applies. All rows are written with
-- landlord_id = private.current_landlord_id(); the insert WITH CHECK policies are
-- satisfied. Same pattern as 009_rent_dues_generation.sql.
--
-- Atomicity: each row runs inside a BEGIN...EXCEPTION block only to enrich the
-- error with the 1-based row index; the error is then RE-RAISED (with the
-- original SQLSTATE) so the whole function aborts and rolls back. All-or-nothing
-- (ADR-004: "cœur métier -- vigilance maximale").
--
-- p_rows: JSON array. Each element:
--   { unit_name, unit_type,                              -- logement (always created)
--     first_name?, last_name?, phone?, email?,           -- locataire (optional block)
--     monthly_rent_amount?, due_day?, start_date?,       -- bail (with the tenant block)
--     end_date?, currency? }
-- A row with no first_name creates a vacant logement (no tenant, no lease).

create or replace function public.bulk_onboard_portfolio(
  p_property_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_landlord uuid;
  v_prop uuid;
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
begin
  v_landlord := private.current_landlord_id();
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;

  select id into v_prop
  from public.properties
  where id = p_property_id
    and landlord_id = v_landlord
    and deleted_at is null;

  if v_prop is null then
    raise exception 'property_not_found' using errcode = 'P0002';
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

  return jsonb_build_object(
    'units', v_units,
    'tenants', v_tenants,
    'leases', v_leases,
    'dues', v_dues
  );
end;
$$;

revoke all on function public.bulk_onboard_portfolio(uuid, jsonb) from public, anon;
grant execute on function public.bulk_onboard_portfolio(uuid, jsonb) to authenticated;
