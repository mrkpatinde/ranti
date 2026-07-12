-- log_product_event : réservée aux sessions authentifiées.
--
-- La fonction est SECURITY DEFINER et déjà inoffensive pour anon
-- (private.current_landlord_id() null → no-op), mais l'advisor Supabase la
-- signale exécutable par anon via /rest/v1/rpc/. Aucun appelant anon n'existe
-- (seul lib/analytics — server-only, session propriétaire — l'utilise) :
-- on retire la surface plutôt que de la garder « inoffensive ».
--
-- Piège : Postgres accorde EXECUTE à PUBLIC par défaut à la création d'une
-- fonction — « revoke from anon » seul est inopérant tant que le grant PUBLIC
-- subsiste (anon en hérite). Il faut révoquer PUBLIC, puis re-granter
-- explicitement les rôles légitimes.
--
-- Les fonctions *_by_token (reçus, déclarations locataire) restent exécutables
-- par anon : c'est le cœur du flux deux-voix sans compte (ADR-013).

revoke execute on function public.log_product_event(text, jsonb) from public, anon;
grant execute on function public.log_product_event(text, jsonb) to authenticated, service_role;
