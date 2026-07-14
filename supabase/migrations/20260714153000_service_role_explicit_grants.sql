-- Grants explicites service_role — divergence prod / local (leçon 2026-07-05, épisode 3).
--
-- Constat (2026-07-14) : le stack local (CLI v2.108) durcit les default
-- privileges du schéma public : pour les tables créées par `postgres`, les
-- rôles anon/authenticated/service_role ne reçoivent plus que
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN (pg_default_acl `Dxtm`). En prod
-- (projet pcxkxeesgusorrpmrkaj, défauts legacy), service_role hérite du DML
-- complet (`arwdDxtm`). Le cron /api/cron/reminders (createAdminClient =
-- service_role) fonctionne donc en prod mais échoue sur un stack local :
--   set role service_role; select count(*) from public.rent_dues;
--   → permission denied for table rent_dues
-- Si Supabase applique un jour les défauts durcis en prod, le cron casse en
-- silence (query failed → return 0). Convention repo : ne jamais compter sur
-- les défauts — chaque privilège requis est accordé explicitement.
--
-- Périmètre = ce que le code service_role fait AUJOURD'HUI :
--   - cron reminders : SELECT rent_dues/reminders/tenants/units,
--     UPDATE rent_dues (next/last_reminder_at, reminder_count),
--     INSERT reminders (journal d'envoi) ;
--   - page publique /verifier/[id] : SELECT receipts ;
--   - webhook Kkiapay : RPC SECURITY DEFINER uniquement (execute déjà
--     accordé par 20260714120000, aucun grant table nécessaire).
-- En prod ces grants existent déjà (défauts legacy) : no-op idempotent.

grant select, update on table public.rent_dues to service_role;
grant select, insert on table public.reminders to service_role;
grant select on table public.tenants to service_role;
grant select on table public.units to service_role;
grant select on table public.receipts to service_role;
