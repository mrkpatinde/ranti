-- Grants explicites authenticated — divergence prod / local (leçon 2026-07-05,
-- même famille que 20260714153000 pour service_role).
--
-- Constat (2026-07-14) : le stack local (CLI v2.108) durcit les default
-- privileges du schéma public : tables créées par `postgres` → anon/
-- authenticated/service_role ne reçoivent que TRUNCATE/REFERENCES/TRIGGER/
-- MAINTAIN (`Dxtm`), et fonctions → EXECUTE pour personne (`{postgres=X}`).
-- En prod (projet pcxkxeesgusorrpmrkaj, défauts legacy), authenticated hérite
-- du DML complet et d'EXECUTE : l'app propriétaire marche par héritage.
-- En local, authenticated n'a SELECT que sur les tables à grant explicite
-- (reminder_events, payment_transactions…) — rent_dues, leases, tenants,
-- units, landlords, properties, receipts… n'ont AUCUN grant : tout le flux
-- local est cassé. Convention repo : ne jamais compter sur les défauts.
--
-- Périmètre = ce que le code authenticated fait AUJOURD'HUI
-- (grep .from( dans apps/web/src hors createAdminClient + corps des RPC
-- SECURITY INVOKER + policies RLS existantes). Least privilege :
--   - aucun DELETE nulle part (soft delete = UPDATE deleted_at, et aucune
--     policy RLS DELETE n'existe) ;
--   - pas de grant sur audit_logs ni payment_proofs (policies RLS présentes
--     mais aucun code authenticated ne les touche encore) ;
--   - product_events : écrit via log_product_event SECURITY DEFINER,
--     aucun grant table nécessaire ;
--   - reminder_events, payment_transactions, journal_feed, rent_due_balances :
--     déjà couverts par leurs migrations (20260705130000, 20260714120000…).
--
-- Détail par table (code → privilège) :
--   landlords    : queries + auth/callback (SELECT), signup (INSERT),
--                  payment_alias (UPDATE)
--   properties   : queries (SELECT), création (INSERT), édition + archivage
--                  deleted_at (UPDATE)
--   units        : queries (SELECT), création (INSERT), édition/dispo/
--                  archivage (UPDATE)
--   tenants      : queries (SELECT), création + bulk_onboard (INSERT),
--                  édition/archivage (UPDATE)
--   leases       : queries (SELECT), création + bulk_onboard (INSERT),
--                  fin de bail/édition + activate_lease (UPDATE)
--   rent_dues    : queries (SELECT), generate_rent_dues (INSERT),
--                  cancel_rent_due + recompute_rent_due_status (UPDATE)
--   rent_receptions : queries collections + sms/collection (SELECT),
--                  record_collection_core (INSERT),
--                  confirm/cancel_collection (UPDATE)
--   rent_reception_allocations : lectures des cœurs (SELECT),
--                  record_collection_core + allocate_reception (INSERT) —
--                  jamais d'UPDATE dans le code, pas de grant
--   receipts     : queries (SELECT), generate_receipt_core (INSERT),
--                  cancel/replace_receipt (UPDATE)
--   reminders    : queries reminders (SELECT) — écritures réservées au cron
--                  service_role
--
-- En prod ces grants existent déjà (défauts legacy) : no-op idempotent.

grant select, insert, update on table public.landlords                  to authenticated;
grant select, insert, update on table public.properties                 to authenticated;
grant select, insert, update on table public.units                      to authenticated;
grant select, insert, update on table public.tenants                    to authenticated;
grant select, insert, update on table public.leases                     to authenticated;
grant select, insert, update on table public.rent_dues                  to authenticated;
grant select, insert, update on table public.rent_receptions            to authenticated;
grant select, insert         on table public.rent_reception_allocations to authenticated;
grant select, insert, update on table public.receipts                   to authenticated;
grant select                 on table public.reminders                  to authenticated;

-- Fonctions : les wrappers publics (record_collection, confirm_collection,
-- generate_receipt) sont SECURITY INVOKER et délèguent aux cœurs du schéma
-- private, eux aussi INVOKER — l'EXECUTE des cœurs doit donc être accordé à
-- authenticated. En local seuls private.current_landlord_id,
-- private.recompute_rent_due_status et le cœur 11 args l'avaient ; les
-- fonctions ci-dessous étaient bloquées (permission denied for function)
-- alors que la prod passe par les défauts legacy (EXECUTE hérité).
-- NB : la surcharge 10 args du cœur est supprimée par 20260714120000 —
-- seul le cœur 11 args (p_reference default null) subsiste.
grant execute on function private.confirm_collection_core(uuid, uuid) to authenticated;
grant execute on function private.generate_receipt_core(uuid, uuid) to authenticated;
grant execute on function private.record_collection_core(
  uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text, text, text
) to authenticated;
