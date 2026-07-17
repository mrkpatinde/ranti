-- Moindre privilège : retrait des écritures directes au rôle `anon`.
-- Suivi audit sécurité 2026-07-17 (/cso) — finding #1, defense-in-depth.
--
-- Constat (prod pcxkxeesgusorrpmrkaj) : `anon` hérite des défauts legacy
-- Supabase et détient INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER sur les
-- ~14 tables métier (53 grants d'écriture). L'isolation tient AUJOURD'HUI
-- uniquement parce que chaque policy RLS échoue en null pour anon
-- (private.current_landlord_id() / auth.uid() = NULL). C'est une ceinture sans
-- bretelles : une seule policy future en `to public USING (true)`, ou une table
-- nouvelle sans policy, exposerait immédiatement l'écriture non authentifiée.
--
-- Pourquoi c'est sûr (vérifié chemin par chemin, audit 2026-07-17) : AUCUN code
-- n'écrit une table en tant que `anon`.
--   - Flux publics locataire (/confirmer, /recu) : uniquement des RPC
--     `*_by_token` SECURITY DEFINER (EXECUTE accordé à anon). Une fonction
--     DEFINER écrit en tant que son PROPRIÉTAIRE, pas en tant qu'appelant :
--     retirer le DML de table à anon ne les touche pas. EXECUTE ≠ grant table.
--   - App propriétaire (landlords/tenants/units/properties/leases/actions.ts) :
--     écritures directes MAIS sous JWT → rôle `authenticated`, jamais `anon`.
--   - Cron + /verifier/[id] : service_role.
--
-- Périmètre volontairement restreint aux ÉCRITURES : SELECT est conservé (déjà
-- neutralisé par RLS ; aucun read direct anon trouvé, mais on limite le rayon
-- du changement). Un retrait de SELECT anon pourra suivre après audit dédié.
--
-- Idempotent : en prod le revoke est effectif (grants legacy présents) ; là où
-- anon n'a déjà pas ces droits (stack local durci), REVOKE est un no-op.

-- 1. Retrait sur toutes les tables ET vues existantes du schéma public.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- 2. Empêcher la ré-attribution automatique sur les FUTURES tables. Les entrées
--    de default privileges qui rouvrent anon sont détenues par `postgres` ET
--    `supabase_admin` (pg_default_acl). On couvre postgres (rôle des migrations)
--    en direct ; supabase_admin en best-effort (le rôle appliquant la migration
--    peut ne pas avoir le droit de modifier ses default privileges).
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;

do $$
begin
  execute
    'alter default privileges for role supabase_admin in schema public '
    || 'revoke insert, update, delete, truncate, references, trigger on tables from anon';
exception when insufficient_privilege then
  raise notice
    'skip ADP supabase_admin (privilège insuffisant) : les tables créées par '
    'supabase_admin garderont le défaut anon — à couvrir manuellement si besoin.';
end $$;
