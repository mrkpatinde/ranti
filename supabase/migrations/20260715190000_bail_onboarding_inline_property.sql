-- Ranti: onboarding bail-centric — création du lieu INLINE dans l'écran bail.
-- Target: PostgreSQL 17 / Supabase
--
-- ADR-020 : l'entrée unique devient « créer un bail ». Un propriétaire vierge
-- crée lieu + logement + occupant + bail dans le MÊME écran, et Ranti génère
-- les échéances immédiatement. Jusqu'ici bulk_onboard_portfolio exigeait un
-- p_property_id EXISTANT ; on étend la RPC pour créer le lieu inline sans
-- ouvrir un second chemin d'écriture (règle ADR-016 : une seule RPC atomique).
--
-- Nouvelle signature (p_property jsonb, p_rows jsonb). p_property :
--   { "id": "<uuid>" }                      -> lieu existant (vérifié possédé)
--   { "name": "...", "city"?, "address"? }  -> lieu créé inline (nom requis)
--
-- L'ancienne signature (uuid, jsonb) est SUPPRIMÉE dans la même migration
-- (leçon surcharges ambiguës : jamais deux signatures qui coexistent).
--
-- SECURITY INVOKER : la RLS s'applique ; tout est écrit avec
-- landlord_id = private.current_landlord_id(). Atomicité et génération des
-- échéances inchangées (activate_lease / generate_rent_dues, ADR-004).

begin;

create or replace function public.bulk_onboard_portfolio(
  p_property jsonb,
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
begin
  v_landlord := private.current_landlord_id();
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
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

  return jsonb_build_object(
    'property_id', v_prop,
    'units', v_units,
    'tenants', v_tenants,
    'leases', v_leases,
    'dues', v_dues
  );
end;
$$;

revoke all on function public.bulk_onboard_portfolio(jsonb, jsonb) from public, anon;
grant execute on function public.bulk_onboard_portfolio(jsonb, jsonb) to authenticated;

-- Ancienne signature retirée : plus aucun chemin (uuid, jsonb).
drop function if exists public.bulk_onboard_portfolio(uuid, jsonb);

commit;
