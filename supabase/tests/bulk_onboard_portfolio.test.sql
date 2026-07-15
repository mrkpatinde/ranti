-- Test SQL transactionnel — bulk_onboard_portfolio (onboarding groupé).
-- Source de vérité = Postgres. Crée des données JETABLES, appelle la vraie
-- fonction public.bulk_onboard_portfolio, vérifie l'atomicité + la génération
-- d'échéances (déléguée à activate_lease/generate_rent_dues, ADR-004), puis
-- ROLLBACK : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bulk_onboard_portfolio.test.sql
--
-- Baux de test = 2023 (passé) -> horizon borné par end_date -> déterministe.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('a1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'bulk-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('a2222222-2222-2222-2222-222222222222',
        'a1111111-1111-1111-1111-111111111111',
        '+22990000001', 'Bulk', 'Test');

-- auth.uid() -> ce landlord (current_landlord_id l'exige).
select set_config('request.jwt.claim.sub',
                  'a1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('a3333333-3333-3333-3333-333333333333',
        'a2222222-2222-2222-2222-222222222222', 'Cour Bulk');

-- ---------------------------------------------------------------------------
-- Cas nominal : 2 logements occupés (dates de début différentes, baux passés
-- -> déterministe) + 1 logement vacant.
-- ---------------------------------------------------------------------------
select public.bulk_onboard_portfolio(
  '{"id":"a3333333-3333-3333-3333-333333333333"}'::jsonb,
  '[
     {"unit_name":"U1","unit_type":"room","first_name":"Aline","last_name":"Un","phone":"+2290100000001","monthly_rent_amount":"50000","due_day":"5","start_date":"2023-01-05","end_date":"2023-03-31"},
     {"unit_name":"U2","unit_type":"room","first_name":"Koffi","last_name":"Deux","phone":"+2290100000002","monthly_rent_amount":"60000","due_day":"10","start_date":"2023-02-10","end_date":"2023-03-31"},
     {"unit_name":"U3","unit_type":"room"}
   ]'::jsonb
);

do $$
declare u int; t int; l int; d int; occ int; vac int;
begin
  select count(*) into u from public.units where landlord_id='a2222222-2222-2222-2222-222222222222';
  select count(*) into t from public.tenants where landlord_id='a2222222-2222-2222-2222-222222222222';
  select count(*) into l from public.leases where landlord_id='a2222222-2222-2222-2222-222222222222' and status='active';
  select count(*) into d from public.rent_dues where landlord_id='a2222222-2222-2222-2222-222222222222';
  select count(*) into occ from public.units where landlord_id='a2222222-2222-2222-2222-222222222222' and availability_status='occupied';
  select count(*) into vac from public.units where landlord_id='a2222222-2222-2222-2222-222222222222' and availability_status='available';

  if u <> 3 then raise exception 'units=% (attendu 3)', u using errcode='90001'; end if;
  if t <> 2 then raise exception 'tenants=% (attendu 2)', t using errcode='90001'; end if;
  if l <> 2 then raise exception 'leases active=% (attendu 2)', l using errcode='90001'; end if;
  -- U1: janvier+février+mars = 3 ; U2: février+mars = 2 ; total 5.
  if d <> 5 then raise exception 'dues=% (attendu 5)', d using errcode='90001'; end if;
  if occ <> 2 then raise exception 'logements occupés=% (attendu 2)', occ using errcode='90001'; end if;
  if vac <> 1 then raise exception 'logements vacants=% (attendu 1)', vac using errcode='90001'; end if;

  -- Échéance historique correcte pour la date de début propre à chaque ligne.
  if not exists (select 1 from public.rent_dues rd join public.leases lz on lz.id=rd.lease_id
                 join public.units un on un.id=lz.unit_id
                 where un.name='U2' and rd.period_start=date '2023-02-01') then
    raise exception 'U2: première échéance février manquante' using errcode='90001';
  end if;

  raise notice 'OK cas nominal : units=3 tenants=2 leases=2 dues=5 (occ=2 vac=1)';
end $$;

-- ---------------------------------------------------------------------------
-- Atomicité : un nom de logement dupliqué dans la propriété (unique
-- (property_id, name) -> 23505) fait rouler back TOUT le lot.
-- ---------------------------------------------------------------------------
do $$
declare raised boolean := false; n int; msg text;
begin
  begin
    perform public.bulk_onboard_portfolio(
      '{"id":"a3333333-3333-3333-3333-333333333333"}'::jsonb,
      '[{"unit_name":"DupX","unit_type":"room"},{"unit_name":"DupX","unit_type":"room"}]'::jsonb);
  exception when others then
    raised := true;
    get stacked diagnostics msg = message_text;
  end;

  if not raised then raise exception 'ATOMIC FAIL: doublon de nom non rejeté' using errcode='90001'; end if;
  select count(*) into n from public.units
   where landlord_id='a2222222-2222-2222-2222-222222222222' and name='DupX';
  if n <> 0 then raise exception 'ATOMIC FAIL: % logement(s) DupX créé(s) malgré rollback', n using errcode='90001'; end if;

  raise notice 'OK atomicité : lot rejeté (%), 0 logement DupX', msg;
end $$;

-- ---------------------------------------------------------------------------
-- Propriété d'un autre landlord -> refus (P0002).
-- ---------------------------------------------------------------------------
do $$
declare raised boolean := false;
begin
  begin
    perform public.bulk_onboard_portfolio(
      '{"id":"99999999-9999-9999-9999-999999999999"}'::jsonb,
      '[{"unit_name":"X","unit_type":"room"}]'::jsonb);
  exception when sqlstate 'P0002' then raised := true;
  end;
  if not raised then raise exception 'SECURITY FAIL: propriété étrangère acceptée' using errcode='90001'; end if;
  raise notice 'OK sécurité : propriété étrangère rejetée (P0002)';
end $$;

-- ---------------------------------------------------------------------------
-- Lieu créé INLINE (ADR-020) : p_property = {name, city} -> propriété créée
-- dans la même transaction, rattachée au landlord courant.
-- ---------------------------------------------------------------------------
do $$
declare v jsonb; v_prop uuid;
begin
  select public.bulk_onboard_portfolio(
    '{"name":"Cour Inline","city":"Calavi"}'::jsonb,
    '[{"unit_name":"I1","unit_type":"room","first_name":"Awa","last_name":"Trois","phone":"+2290100000003","monthly_rent_amount":"40000","due_day":"5","start_date":"2023-01-05","end_date":"2023-02-28"}]'::jsonb
  ) into v;

  select id into v_prop from public.properties
   where landlord_id='a2222222-2222-2222-2222-222222222222' and name='Cour Inline';
  if v_prop is null then raise exception 'INLINE FAIL: lieu non créé' using errcode='90001'; end if;
  if (v->>'property_id')::uuid <> v_prop then
    raise exception 'INLINE FAIL: property_id retourné incohérent' using errcode='90001'; end if;
  if jsonb_array_length(v->'lease_ids') <> 1 then
    raise exception 'INLINE FAIL: lease_ids=% (attendu 1)', v->'lease_ids' using errcode='90001'; end if;
  if not exists (select 1 from public.rent_dues
                 where lease_id = ((v->'lease_ids')->>0)::uuid) then
    raise exception 'INLINE FAIL: aucune échéance générée' using errcode='90001'; end if;

  raise notice 'OK lieu inline : propriété créée + bail actif + échéances';
end $$;

-- ---------------------------------------------------------------------------
-- Nom de lieu vide -> refus (property_name_required, P0001).
-- ---------------------------------------------------------------------------
do $$
declare raised boolean := false; msg text;
begin
  begin
    perform public.bulk_onboard_portfolio(
      '{"name":"   "}'::jsonb,
      '[{"unit_name":"Z","unit_type":"room"}]'::jsonb);
  exception when others then
    raised := true;
    get stacked diagnostics msg = message_text;
  end;
  if not raised or msg not like '%property_name_required%' then
    raise exception 'VALIDATION FAIL: nom vide accepté ou erreur inattendue (%)', msg using errcode='90001';
  end if;
  raise notice 'OK validation : nom de lieu vide rejeté (property_name_required)';
end $$;

rollback;
