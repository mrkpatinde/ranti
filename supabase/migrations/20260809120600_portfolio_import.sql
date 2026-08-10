-- ============================================================
-- 20260809120600 — Import de portefeuille par fichier (brique 1)
-- ============================================================
-- L'existant, bulk_onboard_portfolio, n'accepte qu'un seul bien par appel,
-- ignore le mandant, et n'est alimenté que par un formulaire HTML : aucun
-- parseur de fichier n'existait dans le dépôt. Une agence qui gère 60 lots
-- pour 12 propriétaires ne peut pas entrer dans le produit à ce prix-là.
--
-- Deux fonctions, pour un parcours en deux temps :
--
--   validate_portfolio_import()  lit le fichier converti en JSON, ne touche à
--                                rien, et renvoie un verdict ligne par ligne.
--                                L'agence corrige son Excel et recommence.
--
--   import_portfolio()           exécute en tout-ou-rien, idempotent par
--                                p_request_id. Mandants et biens sont
--                                rapprochés par nom : un fichier où le même
--                                propriétaire revient sur 8 lignes crée un
--                                seul mandant.
--
-- Le tout-ou-rien n'est acceptable que parce que la validation précède : on
-- n'échoue jamais au milieu d'un import de 60 lignes sur une surprise.
-- ============================================================

begin;

-- Le rapprochement des biens par nom (import_portfolio ci-dessous) suppose
-- qu'un nom désigne un seul bien. Sans index unique, deux imports concurrents
-- passent tous deux le SELECT avant que l'autre n'ait committé et créent deux
-- biens homonymes : le portefeuille est scindé en silence. Les mandants sont
-- déjà protégés par owners_landlord_name_unique.
create unique index if not exists properties_landlord_name_unique
  on public.properties (landlord_id, lower(btrim(name)))
  where deleted_at is null;

-- La contrainte de portée sur idempotency_keys (posée en 20260716130000,
-- étendue en 20260716210000) énumère les scopes autorisés. L'import y ajoute
-- le sien ; 'add_lease_charge' en sort, la fonctionnalité ayant été retirée
-- par 20260809120100.
alter table public.idempotency_keys
  drop constraint if exists idempotency_keys_scope_check;

alter table public.idempotency_keys
  add constraint idempotency_keys_scope_check
  check (scope in ('record_collection', 'bulk_onboard', 'import_portfolio'));

-- ── Normalisation d'une ligne ───────────────────────────────────────────────
create or replace function private.import_row_errors(elem jsonb)
returns text[]
language plpgsql
immutable
set search_path = private, public
as $$
declare
  e text[] := '{}';
  v_rent text := nullif(btrim(elem->>'monthly_rent_amount'), '');
  v_day  text := nullif(btrim(elem->>'due_day'), '');
  v_start text := nullif(btrim(elem->>'start_date'), '');
  v_type text := nullif(btrim(elem->>'unit_type'), '');
  has_tenant boolean;
begin
  if coalesce(btrim(elem->>'property_name'), '') = '' then
    e := e || 'Nom du bien manquant'::text;
  end if;
  if coalesce(btrim(elem->>'unit_name'), '') = '' then
    e := e || 'Nom du lot manquant'::text;
  end if;

  if v_type is not null and v_type not in
     ('house','apartment','room','shop','store','office','warehouse','other') then
    e := e || format('Type de lot inconnu : %s', v_type);
  end if;

  if nullif(btrim(elem->>'owner_fee_rate_bp'), '') is not null then
    begin
      if (elem->>'owner_fee_rate_bp')::int not between 0 and 10000 then
        e := e || 'Taux d''honoraires hors bornes (0 à 10000 points de base)'::text;
      end if;
    exception when others then
      e := e || 'Taux d''honoraires illisible'::text;
    end;
  end if;

  -- Loyer, jour d'échéance et dates sont contrôlés dès qu'ils sont renseignés,
  -- même sur un lot vacant : sinon la validation laisse passer une valeur que
  -- l'insertion refusera plus loin, et l'import échoue après coup au lieu
  -- d'être corrigé à l'aperçu.
  if v_rent is not null then
    begin
      if v_rent::int <= 0 then e := e || 'Loyer nul ou négatif'::text; end if;
    exception when others then
      e := e || format('Loyer illisible : %s', v_rent);
    end;
  end if;

  if v_day is not null then
    begin
      if v_day::int not between 1 and 31 then
        e := e || 'Jour d''échéance hors bornes (1 à 31)'::text;
      end if;
    exception when others then
      e := e || format('Jour d''échéance illisible : %s', v_day);
    end;
  end if;

  -- Format ISO exigé, sans exception. Un cast direct suivrait le DateStyle du
  -- serveur (ISO, MDY) : 05/03/2026 deviendrait le 3 mai au lieu du 5 mars,
  -- silencieusement. L'interface convertit jj/mm/aaaa avant d'appeler ; la RPC
  -- reste exposée à PostgREST et doit se défendre seule.
  if v_start is not null and v_start !~ '^\d{4}-\d{2}-\d{2}$' then
    e := e || format('Date de début attendue au format AAAA-MM-JJ : %s', v_start);
  end if;
  if nullif(btrim(elem->>'end_date'), '') is not null
     and btrim(elem->>'end_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    e := e || format('Date de fin attendue au format AAAA-MM-JJ : %s', btrim(elem->>'end_date'));
  end if;

  has_tenant := coalesce(btrim(elem->>'tenant_first_name'), '') <> ''
             or coalesce(btrim(elem->>'tenant_last_name'), '')  <> ''
             or coalesce(btrim(elem->>'tenant_phone'), '')      <> '';

  -- Un lot vacant est une ligne parfaitement valide : pas de locataire, pas
  -- de bail, pas d'échéance. C'est le cas le plus courant d'un portefeuille
  -- réel et il ne doit pas produire d'erreur.
  if has_tenant then
    if coalesce(btrim(elem->>'tenant_first_name'), '') = ''
       and coalesce(btrim(elem->>'tenant_last_name'), '') = '' then
      e := e || 'Locataire sans nom'::text;
    end if;
    if coalesce(btrim(elem->>'tenant_phone'), '') = '' then
      e := e || 'Téléphone du locataire manquant'::text;
    end if;

    if v_rent is null then
      e := e || 'Montant du loyer manquant'::text;
    end if;
    if v_day is null then
      e := e || 'Jour d''échéance manquant'::text;
    end if;
    if v_start is null then
      e := e || 'Date de début du bail manquante'::text;
    end if;
  end if;

  return e;
end;
$$;

-- ── 1. Validation, sans écriture ────────────────────────────────────────────
create or replace function public.validate_portfolio_import(p_rows jsonb)
returns table (
  line       integer,
  unit_label text,
  errors     text[]
)
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_landlord uuid := private.current_landlord_id();
begin
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows_invalid' using errcode = 'P0001';
  end if;

  return query
  with src as (
    select value as elem, ordinality::int as idx
    from jsonb_array_elements(p_rows) with ordinality
  ),
  keyed as (
    select
      s.idx,
      s.elem,
      lower(btrim(coalesce(s.elem->>'property_name', ''))) as prop_key,
      lower(btrim(coalesce(s.elem->>'unit_name', '')))     as unit_key
    from src s
  )
  select
    k.idx,
    btrim(coalesce(k.elem->>'property_name', '') || ' · ' || coalesce(k.elem->>'unit_name', '')),
    private.import_row_errors(k.elem)
      -- Doublon à l'intérieur du fichier lui-même.
      || case when count(*) over (partition by k.prop_key, k.unit_key) > 1
              then array['Lot en double dans le fichier'::text]
              else '{}'::text[] end
      -- Collision avec un lot déjà enregistré dans le portefeuille.
      || case when exists (
              select 1
              from public.units u
              join public.properties pr on pr.id = u.property_id
              where pr.landlord_id = v_landlord
                and pr.deleted_at is null
                and u.deleted_at is null
                and lower(btrim(pr.name)) = k.prop_key
                and lower(btrim(u.name))  = k.unit_key
            ) then array['Lot déjà présent dans le portefeuille'::text]
              else '{}'::text[] end
  from keyed k
  order by k.idx;
end;
$$;

revoke all on function public.validate_portfolio_import(jsonb) from public, anon;
grant execute on function public.validate_portfolio_import(jsonb) to authenticated;

-- ── 2. Import, tout-ou-rien, idempotent ─────────────────────────────────────
create or replace function public.import_portfolio(
  p_rows       jsonb,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_landlord uuid := private.current_landlord_id();
  v_result   jsonb;
  elem       jsonb;
  idx        int;
  v_errors   text[];
  v_owner    uuid;
  v_prop     uuid;
  v_unit     uuid;
  v_tenant   uuid;
  v_lease    uuid;
  v_owners   int := 0;
  v_props    int := 0;
  v_units    int := 0;
  v_tenants  int := 0;
  v_leases   int := 0;
  v_dues     int := 0;
  v_lease_ids uuid[] := '{}';
  v_name     text;
  v_state    text;
  v_msg      text;
begin
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'no_rows' using errcode = 'P0001';
  end if;

  -- Idempotence : un double clic, une reprise réseau ou un rejeu ne
  -- dupliquent pas le portefeuille. Même mécanisme que bulk_onboard_portfolio.
  if p_request_id is not null then
    begin
      insert into public.idempotency_keys (landlord_id, scope, key)
      values (v_landlord, 'import_portfolio', p_request_id);
    exception when unique_violation then
      select k.result into v_result
      from public.idempotency_keys k
      where k.landlord_id = v_landlord
        and k.scope = 'import_portfolio'
        and k.key = p_request_id;
      if v_result is null then
        raise exception 'import_in_progress' using errcode = 'P0001';
      end if;
      return v_result;
    end;
  end if;

  -- Barrage : on ne commence pas un import qui échouera en cours de route.
  select coalesce(array_agg(format('ligne %s : %s', v.line, array_to_string(v.errors, ' ; '))), '{}')
  into v_errors
  from public.validate_portfolio_import(p_rows) v
  where cardinality(v.errors) > 0;

  if cardinality(v_errors) > 0 then
    raise exception 'validation_failed: %', array_to_string(v_errors, E'\n')
      using errcode = 'P0001';
  end if;

  for elem, idx in
    select value, ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      -- Mandant : rapproché par nom, créé au premier passage.
      v_owner := null;
      v_name := nullif(btrim(elem->>'owner_name'), '');
      if v_name is not null then
        select o.id into v_owner
        from public.owners o
        where o.landlord_id = v_landlord
          and o.deleted_at is null
          and lower(btrim(o.display_name)) = lower(v_name);

        if v_owner is null then
          insert into public.owners (landlord_id, display_name, phone, email, fee_rate_bp)
          values (
            v_landlord,
            v_name,
            nullif(btrim(elem->>'owner_phone'), ''),
            nullif(btrim(elem->>'owner_email'), ''),
            coalesce(nullif(btrim(elem->>'owner_fee_rate_bp'), '')::int, 0)
          )
          returning id into v_owner;
          v_owners := v_owners + 1;
        end if;
      end if;

      -- Bien : rapproché par nom dans le portefeuille.
      v_name := btrim(elem->>'property_name');
      select pr.id into v_prop
      from public.properties pr
      where pr.landlord_id = v_landlord
        and pr.deleted_at is null
        and lower(btrim(pr.name)) = lower(v_name);

      if v_prop is null then
        insert into public.properties (landlord_id, name, city, address, owner_id)
        values (
          v_landlord, v_name,
          nullif(btrim(elem->>'property_city'), ''),
          nullif(btrim(elem->>'property_address'), ''),
          v_owner
        )
        returning id into v_prop;
        v_props := v_props + 1;
      elsif v_owner is not null then
        -- Le fichier fait autorité sur le rattachement au mandant.
        update public.properties set owner_id = v_owner
        where id = v_prop and owner_id is distinct from v_owner;
      end if;

      insert into public.units (
        landlord_id, property_id, name, unit_type, availability_status,
        default_rent_amount, default_due_day, notes
      )
      values (
        v_landlord, v_prop,
        btrim(elem->>'unit_name'),
        coalesce(nullif(btrim(elem->>'unit_type'), ''), 'other'),
        case when nullif(btrim(elem->>'tenant_phone'), '') is not null
             then 'occupied' else 'available' end,
        nullif(btrim(elem->>'monthly_rent_amount'), '')::int,
        nullif(btrim(elem->>'due_day'), '')::int,
        nullif(btrim(elem->>'unit_notes'), '')
      )
      returning id into v_unit;
      v_units := v_units + 1;

      if nullif(btrim(elem->>'tenant_phone'), '') is not null then
        insert into public.tenants (landlord_id, first_name, last_name, phone, email)
        values (
          v_landlord,
          nullif(btrim(elem->>'tenant_first_name'), ''),
          nullif(btrim(elem->>'tenant_last_name'), ''),
          btrim(elem->>'tenant_phone'),
          nullif(btrim(elem->>'tenant_email'), '')
        )
        returning id into v_tenant;
        v_tenants := v_tenants + 1;

        insert into public.leases (
          landlord_id, unit_id, tenant_id, monthly_rent_amount, currency,
          due_day, start_date, end_date, status
        )
        values (
          v_landlord, v_unit, v_tenant,
          (btrim(elem->>'monthly_rent_amount'))::int,
          coalesce(nullif(btrim(elem->>'currency'), ''), 'XOF'),
          (btrim(elem->>'due_day'))::int,
          (btrim(elem->>'start_date'))::date,
          nullif(btrim(elem->>'end_date'), '')::date,
          'draft'
        )
        returning id into v_lease;

        -- Réutilise l'activation éprouvée : draft -> active, exclusion de
        -- chevauchement, génération des échéances (ADR-004).
        perform public.activate_lease(v_lease);
        v_leases := v_leases + 1;
        v_lease_ids := array_append(v_lease_ids, v_lease);
      end if;

    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      raise exception 'ligne %: %', idx, v_msg using errcode = v_state;
    end;
  end loop;

  if array_length(v_lease_ids, 1) is not null then
    select count(*) into v_dues
    from public.rent_dues d
    where d.lease_id = any(v_lease_ids) and d.deleted_at is null;
  end if;

  v_result := jsonb_build_object(
    'owners_created',     v_owners,
    'properties_created', v_props,
    'units_created',      v_units,
    'tenants_created',    v_tenants,
    'leases_activated',   v_leases,
    'rent_dues_generated', v_dues
  );

  if p_request_id is not null then
    update public.idempotency_keys
    set result = v_result
    where landlord_id = v_landlord
      and scope = 'import_portfolio'
      and key = p_request_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.import_portfolio(jsonb, uuid) from public, anon;
grant execute on function public.import_portfolio(jsonb, uuid) to authenticated;

comment on function public.import_portfolio(jsonb, uuid) is
  'Import d''un portefeuille complet (mandants, biens, lots, locataires, baux)
   en une transaction. Précédé de validate_portfolio_import().';

commit;
