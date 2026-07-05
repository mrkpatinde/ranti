-- ============================================================
-- Fix L2 — bulk_onboard_portfolio : bloc locataire seulement si first_name
-- NON VIDE.
--
-- Problème : le bloc locataire+bail était créé dès que
--   `(elem->>'first_name') is not null`. Une chaîne vide ("") n'est PAS null →
--   un logement censé être vacant recevait un locataire au prénom vide, puis
--   les casts du bail ((monthly_rent_amount)::int, etc.) plantaient sur des
--   valeurs vides. La validation TypeScript amont l'évitait, mais la RPC ne se
--   protégeait pas elle-même.
--
-- Fix : présence locataire = first_name non vide après trim. Sinon logement
-- vacant. Seul ce test change ; le reste est identique à 20260705120000.
-- SECURITY INVOKER (RLS s'applique). Idempotent.
-- ============================================================

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
  v_has_tenant boolean;
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
      -- Présence locataire = first_name NON VIDE (une chaîne vide n'est pas un
      -- locataire ; le logement reste vacant).
      v_has_tenant := nullif(btrim(elem->>'first_name'), '') is not null;

      -- Logement: always created.
      insert into public.units (
        landlord_id, property_id, name, unit_type, availability_status, notes
      )
      values (
        v_landlord,
        v_prop,
        elem->>'unit_name',
        elem->>'unit_type',
        case when v_has_tenant then 'occupied' else 'available' end,
        elem->>'unit_notes'
      )
      returning id into v_unit;
      v_units := v_units + 1;

      -- Locataire + bail activé: only when a real tenant block is present.
      if v_has_tenant then
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
