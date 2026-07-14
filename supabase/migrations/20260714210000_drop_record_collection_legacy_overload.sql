-- Drop de la surcharge legacy 7 args de public.record_collection.
--
-- Même piège que le cœur 10 args (supprimé par 20260714120000, leçon
-- « surcharges SQL ambiguës ») : depuis l'ajout de la version 8 args avec
-- p_reference DEFAULT NULL (20260711150000), tout appel à 7 arguments nommés
-- matche LES DEUX signatures → 42725 « function public.record_collection(...)
-- is not unique ». Vérifié sur prod (pcxkxeesgusorrpmrkaj) : le formulaire
-- d'encaissement propriétaire (apps/web/src/lib/collections/actions.ts,
-- rpc('record_collection') sans p_reference) échoue en PGRST203.
--
-- Le défaut de p_reference couvre tous les appels à 7 arguments : aucun
-- appelant ne casse, la résolution redevient unique. Assertion d'absence dans
-- supabase/tests/authenticated_grants.test.sql (même garde que pour le cœur).

drop function if exists public.record_collection(
  uuid, uuid, integer, text, timestamptz, text, jsonb
);
