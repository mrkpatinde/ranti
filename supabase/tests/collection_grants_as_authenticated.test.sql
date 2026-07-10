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
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Bloc 2 : parcours complet encaisser → confirmer → quittance, en `authenticated`
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_due public.rent_dues;
  v_auth uuid;
  v_rid uuid;
  v_receipt uuid;
begin
  select rd.* into v_due from public.rent_dues rd
  where rd.deleted_at is null and rd.status <> 'cancelled'
  order by rd.period_start desc limit 1;
  if v_due.id is null then raise exception 'TEST SETUP: aucune échéance ouverte'; end if;

  select l.auth_user_id into v_auth from public.landlords l where l.id = v_due.landlord_id;
  if v_auth is null then raise exception 'TEST SETUP: propriétaire sans auth_user_id'; end if;

  -- Exactement ce que fait PostgREST pour une requête authentifiée
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_rid := public.record_collection(
    v_due.tenant_id, v_due.unit_id, 1000, 'mobile_money', null, 'test grants',
    jsonb_build_array(jsonb_build_object('rent_due_id', v_due.id, 'amount_allocated', 1000))
  );
  if v_rid is null then raise exception 'FAIL: record_collection a renvoyé null'; end if;

  perform public.confirm_collection(v_rid);

  v_receipt := public.generate_receipt(v_rid);
  if v_receipt is null then raise exception 'FAIL: generate_receipt a renvoyé null'; end if;
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
end $$;
rollback;
