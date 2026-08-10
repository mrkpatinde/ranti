-- ============================================================
-- 20260809120200 — Réparation de la dérive base ↔ migrations
-- ============================================================
-- Constat du 2026-08-09, base de production comparée au dépôt :
--
--   • public.reminders et public.reminder_events portent une policy RLS mais
--     aucune migration ne contient `enable row level security`. Sur une base
--     reconstruite depuis le dépôt, ces policies sont inertes et tout compte
--     authentifié lit les relances (noms, téléphones, messages) de tous les
--     autres portefeuilles.
--   • public.receipts accorde en production DELETE, TRUNCATE, REFERENCES et
--     TRIGGER à `authenticated`, là où la migration 20260714170000 n'accorde
--     que SELECT, INSERT, UPDATE.
--
-- Les deux écarts viennent de DDL appliquée hors migration. Cette migration
-- rend l'état explicite et idempotent : elle est rejouable sur la production
-- comme sur une base neuve et produit le même résultat.
-- ============================================================

begin;

-- 1. RLS sur toute table publique qui ne l'a pas. Balayage générique : une
--    table ajoutée plus tard sans RLS sera rattrapée au prochain passage.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    raise notice 'RLS activée sur public.% (était désactivée)', r.relname;
  end loop;
end $$;

-- 2. Retrait des privilèges qu'aucun parcours produit n'utilise. La
--    suppression logique passe par `deleted_at` (soft delete), jamais par
--    DELETE ; TRUNCATE contourne la RLS par construction ; REFERENCES et
--    TRIGGER n'ont aucun usage côté client.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'revoke delete, truncate, references, trigger on public.%I from anon, authenticated',
      r.relname
    );
  end loop;
end $$;

-- 3. anon n'écrit jamais en direct : tout passe par des RPC SECURITY DEFINER
--    à jeton (quittance locataire). Réassertion de 20260717120000.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'revoke insert, update on public.%I from anon',
      r.relname
    );
  end loop;
end $$;

-- 4. Privilèges par défaut : une table créée plus tard n'hérite d'aucun droit
--    d'écriture pour anon.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;

-- 5. Vue de contrôle : liste les tables publiques dont la RLS serait à
--    nouveau désactivée, ou qui porteraient un privilège retiré ci-dessus.
--    Réservée au service_role — c'est un outil d'exploitation.
create or replace view public.ops_grant_drift as
select
  c.relname                                       as table_name,
  c.relrowsecurity                                as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies,
  coalesce((
    select string_agg(distinct g.privilege_type, ', ' order by g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = c.relname
      and g.grantee in ('anon', 'authenticated')
      and g.privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ), '') as unexpected_privileges
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and (
    not c.relrowsecurity
    or exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = c.relname
        and g.grantee in ('anon', 'authenticated')
        and g.privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    )
  );

revoke all on public.ops_grant_drift from anon, authenticated;
grant select on public.ops_grant_drift to service_role;

comment on view public.ops_grant_drift is
  'Vide = base conforme aux migrations. Toute ligne signale une DDL appliquée hors migration.';

commit;
