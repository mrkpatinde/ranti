-- Grant explicite service_role sur ops_record_collection — divergence prod /
-- local (même famille que 20260714153000, tables service_role, et
-- 20260714170000, authenticated).
--
-- Constat (2026-07-14) : le cockpit ranti-ops (createAdminClient =
-- service_role) appelle rpc('ops_record_collection') (ranti-ops/lib/entries.ts).
-- La revoke de 20260703230000 ne visait que public/anon/authenticated :
-- en prod (projet pcxkxeesgusorrpmrkaj, défauts legacy), service_role garde
-- l'EXECUTE hérité des default privileges. En local (CLI v2.108, défauts
-- durcis), la fonction naît {postgres=X} et l'appel cockpit échoue :
--   permission denied for function ops_record_collection
-- ops_confirm_collection a déjà son grant explicite (20260705170139) ;
-- ops_record_collection était le seul RPC service_role sans grant.
--
-- Inventaire du même passage — aucun autre grant requis (least privilege) :
--   - public.mark_all_overdue_rent_dues : appelée uniquement par pg_cron
--     (job mark-overdue-daily, username = postgres) → {postgres=X} suffit ;
--   - public.audit_manual_reminder_event, private.log_audit : fonctions
--     trigger — EXECUTE n'est vérifié qu'au CREATE TRIGGER, jamais au
--     déclenchement (preuve : ACL prod également révoquées, triggers OK) ;
--   - private.write_audit : appelée seulement depuis les triggers SECURITY
--     DEFINER audit_*_sensitive / audit_soft_archive → s'exécute en postgres ;
--   - private.compute_payment_fees : appelée seulement depuis
--     ingest_payment_notification (SECURITY DEFINER) et les tests SQL ;
--   - public.current_landlord_id : code mort — aucune policy (les 31 policies
--     RLS utilisent private.current_landlord_id), aucune fonction, vue ni
--     code app ne la référence. Pas de grant ; candidate à un DROP dans une
--     migration dédiée.
--
-- En prod ce grant existe déjà (défauts legacy) : no-op idempotent.

grant execute on function public.ops_record_collection(
  uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text
) to service_role;
