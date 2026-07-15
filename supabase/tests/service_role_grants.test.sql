-- Test SQL — grants explicites service_role (migration 20260714153000).
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/service_role_grants.test.sql
--
-- ⚠️ Garde-fou de la leçon 2026-07-05 : les tests tournent en postgres et ne
--    "voient" pas un GRANT manquant — on interroge donc explicitement
--    has_table_privilege, PUIS on rejoue la lecture du cron sous
--    `set local role service_role` (c'est ce smoke test qui aurait détecté
--    la divergence prod/local du 2026-07-14).

begin;

-- ---------------------------------------------------------------------------
-- 1. GRANTS — privilèges requis par le code service_role actuel
-- ---------------------------------------------------------------------------
do $$
declare
  v_priv record;
begin
  for v_priv in
    select * from (values
      ('public.rent_dues', 'SELECT'),
      ('public.rent_dues', 'UPDATE'),
      ('public.reminders', 'SELECT'),
      ('public.reminders', 'INSERT'),
      ('public.tenants',   'SELECT'),
      ('public.units',     'SELECT'),
      ('public.receipts',  'SELECT'),
      -- Vision comptabilité du ledger (20260715070000) : la compta interne
      -- lit net_margin/payin_cost/payout_cost en service_role uniquement.
      ('public.payment_transactions', 'SELECT')
    ) as t(tbl, priv)
  loop
    if not has_table_privilege('service_role', v_priv.tbl, v_priv.priv) then
      raise exception 'FAIL grants: service_role sans % sur %', v_priv.priv, v_priv.tbl;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Smoke test — rejouer la lecture du cron sous le rôle service_role.
--    Un `permission denied` ici = régression des grants (le cron rendrait
--    sent=0 en silence, voir checkRemindersDue).
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  set local role service_role;

  select count(*) into v_count
  from public.rent_dues rd
  join public.tenants t on t.id = rd.tenant_id
  left join public.units u on u.id = rd.unit_id
  where rd.status in ('expected', 'overdue')
    and rd.deleted_at is null;

  select count(*) into v_count from public.reminders;
  select count(*) into v_count from public.receipts;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Fonctions RPC du cockpit ops — EXECUTE explicite pour service_role
--    (20260705170139 pour ops_confirm_collection, 20260714190000 pour
--    ops_record_collection). Garde least-privilege : ces RPC SECURITY DEFINER
--    contournent RLS, jamais exécutables par anon/authenticated.
-- ---------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select * from (values
      ('public.ops_record_collection(uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text)'),
      ('public.ops_confirm_collection(uuid, uuid, text)')
    ) as t(fn)
  loop
    if not has_function_privilege('service_role', v_fn.fn, 'EXECUTE') then
      raise exception 'FAIL grants: service_role sans EXECUTE sur %', v_fn.fn;
    end if;
    if has_function_privilege('anon', v_fn.fn, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn.fn, 'EXECUTE') then
      raise exception 'FAIL grants: % exécutable par anon/authenticated', v_fn.fn;
    end if;
  end loop;
end $$;

rollback;

select 'service_role_grants.test.sql: OK' as result;
