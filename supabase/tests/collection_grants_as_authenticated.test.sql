-- Régression : les wrappers publics d'encaissement doivent être exécutables par
-- le rôle `authenticated`, pas seulement par le propriétaire de la base.
--
-- Contexte : le 2026-07-05, record_collection / confirm_collection /
-- generate_receipt ont été refactorés en wrappers SECURITY INVOKER sur
-- private.*_core. Le `grant execute` sur les cores a été oublié. Résultat :
-- "permission denied for function record_collection_core" en production, pour
-- tout propriétaire connecté, pendant 5 jours.
--
-- Les tests existants ne l'ont pas vu parce qu'ils s'exécutent en tant que
-- `postgres`, propriétaire de la base, qui contourne tous les grants.
-- Ce test impersonne `authenticated` comme le fait PostgREST.
--
-- Exécution : psql / SQL editor. Transactionnel, ROLLBACK — aucun effet
-- persistant, exécutable sur n'importe quel environnement.

-- ---------------------------------------------------------------------------
-- Bloc 1 : l'impersonation doit réellement prendre, sinon le test ne prouve rien
-- ---------------------------------------------------------------------------
begin;
do $$
declare v_who text;
begin
  perform set_config('role', 'authenticated', true);
  select current_user into v_who;
  if v_who <> 'authenticated' then
    raise exception 'FAIL: impersonation inopérante, current_user=%', v_who;
  end if;
  raise notice 'OK bloc 1 : impersonation authenticated effective';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Bloc 2 : parcours complet encaisser → confirmer → quittance, en `authenticated`
--
-- Fixtures JETABLES créées ici même (ROLLBACK final) : le test ne dépend
-- d'aucune donnée préexistante — il tourne sur une base fraîchement migrée
-- comme sur un environnement peuplé.
-- ---------------------------------------------------------------------------
begin;

-- Fixtures PROPRES au test (2026-07-27). Ce bloc piochait auparavant « la
-- dernière échéance de la base » : il dépendait donc des données présentes et
-- échouait dès qu'elle était soldée (constaté en prod le 2026-07-16), puis sur
-- toute base fraîche — `supabase db reset` ne sème qu'une échéance déjà payée,
-- donc restant = 0. Un test de grants ne doit rien supposer du contenu.
-- Insertions faites en `postgres` AVANT l'impersonation : c'est le parcours
-- applicatif qu'on veut mesurer, pas la mise en place.
insert into auth.users (id, instance_id, aud, role, email)
values ('f1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grants-collect@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('f2222222-2222-2222-2222-222222222222','f1111111-1111-1111-1111-111111111111','+22990000077','Grants','Collect');

insert into public.properties (id, landlord_id, name)
values ('f3333333-3333-3333-3333-333333333333','f2222222-2222-2222-2222-222222222222','Cour Grants');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('fa000000-0000-0000-0000-000000000001','f2222222-2222-2222-2222-222222222222','f3333333-3333-3333-3333-333333333333','UG','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('fb000000-0000-0000-0000-000000000001','f2222222-2222-2222-2222-222222222222','Loc','Grants','+22991000077');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('fc000000-0000-0000-0000-000000000001','f2222222-2222-2222-2222-222222222222','fa000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001',50000,5,date '2023-01-05','active');

-- Échéance NON soldée : le cap d'allocation (record_collection_alloc_cap)
-- rejette toute allocation au-delà du dû, il faut donc du restant ≥ 1.
insert into public.rent_dues (id, landlord_id, lease_id, unit_id, tenant_id, period_start, period_end, due_date, amount_due, currency, status)
values ('fd000000-0000-0000-0000-00000000000a','f2222222-2222-2222-2222-222222222222','fc000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001',date '2023-01-01',date '2023-01-31',date '2023-01-05',50000,'XOF','expected');

do $$
declare
  v_due public.rent_dues;
  v_auth uuid;
  v_rid uuid;
  v_receipt uuid;
begin
  select rd.* into v_due
  from public.rent_dues rd
  join public.rent_due_balances b on b.id = rd.id
  where rd.id = 'fd000000-0000-0000-0000-00000000000a'
    and (b.amount_due - b.amount_paid) >= 1;
  if v_due.id is null then raise exception 'TEST SETUP: fixture d''échéance absente ou déjà soldée'; end if;

  select l.auth_user_id into v_auth from public.landlords l where l.id = v_due.landlord_id;
  if v_auth is null then raise exception 'TEST SETUP: propriétaire sans auth_user_id'; end if;

  -- Régression (héritée de recorded_by_ops_entry_path.test.sql, supprimé avec
  -- le chemin opérateur) : sans session, le wrapper landlord lève no_landlord
  -- au lieu d'écrire pour le compte de personne.
  begin
    perform public.record_collection(
      v_due.tenant_id, v_due.unit_id, 1000, 'cash', null, null,
      jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', 1000)),
      null::text);
    raise exception 'FAIL: record_collection sans session aurait dû lever no_landlord';
  exception when others then
    if sqlerrm not like '%no_landlord%' then
      raise exception 'FAIL: erreur inattendue %', sqlerrm;
    end if;
  end;

  -- Exactement ce que fait PostgREST pour une requête authentifiée. Les deux
  -- réglages sont posés : auth.uid() lit `request.jwt.claim.sub` et retombe
  -- sur le sous-champ `sub` de `request.jwt.claims` selon la version de GoTrue.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  perform set_config('role', 'authenticated', true);

  v_rid := public.record_collection(
    v_due.tenant_id, v_due.unit_id, 1, 'mobile_money', null, 'test grants',
    jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', 1))
  );
  if v_rid is null then raise exception 'FAIL: record_collection a renvoyé null'; end if;

  perform public.confirm_collection(v_rid);

  v_receipt := public.generate_receipt(v_rid);
  if v_receipt is null then raise exception 'FAIL: generate_receipt a renvoyé null'; end if;

  raise notice 'OK bloc 2 : encaisser -> confirmer -> quittance sous authenticated';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Bloc 3 : garde-fou explicite sur les grants des cores
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_missing text;
begin
  select string_agg(p.proname, ', ')
    into v_missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('record_collection_core', 'confirm_collection_core', 'generate_receipt_core')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if v_missing is not null then
    raise exception 'FAIL: `authenticated` ne peut pas exécuter : %', v_missing;
  end if;
  raise notice 'OK bloc 3 : les 3 cores private sont executables par authenticated';
end $$;
rollback;
