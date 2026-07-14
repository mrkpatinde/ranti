-- Drop de public.current_landlord_id() — code mort depuis 005.
--
-- Historique : créée en 002 comme helper RLS, remplacée en 005 par
-- private.current_landlord_id() (schéma private inaccessible via PostgREST) ;
-- 005 a repointé toutes les policies vers la version private et révoqué
-- EXECUTE sur la version public, mais l'a laissée en place.
--
-- Constat (2026-07-14, vérifié en local et via inventaire de
-- 20260714190000) : aucune policy RLS (les 31 policies utilisent
-- private.current_landlord_id), aucune fonction (pg_proc.prosrc), aucune
-- vue ni code app (apps/web, ranti-ops) ne référence la version public.
-- Une SECURITY DEFINER orpheline dans le schéma public reste une surface
-- d'attaque inutile (advisor Supabase) : on la supprime.
--
-- private.current_landlord_id() est intouchée.

-- Garde : échoue explicitement si une policy référence encore la version
-- public (protège un replay sur une base divergente).
do $$
begin
  if exists (
    select 1
    from pg_policies
    where qual ilike '%public.current_landlord_id%'
       or with_check ilike '%public.current_landlord_id%'
  ) then
    raise exception 'public.current_landlord_id() encore référencée par une policy — drop annulé';
  end if;
end $$;

drop function if exists public.current_landlord_id();
