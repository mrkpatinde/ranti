-- ============================================================
-- Migration : re-contrôle financier au moment de confirm_collection
-- Problème (P1) : record_collection borne l'allocation au reste dû
--   au moment de la CRÉATION du brouillon (migration 020). Deux
--   brouillons concurrents sur la même échéance restent possibles :
--   confirmer les deux dépasse amount_due (trop-perçu silencieux).
-- Solution : confirm_collection verrouille chaque échéance allouée
--   (FOR UPDATE), recalcule le déjà-confirmé HORS réception en cours,
--   et refuse la confirmation entière si
--   déjà confirmé + montant à confirmer > amount_due.
--   Erreur levée : allocation_exceeds_due_at_confirm.
--   Tout-ou-rien : la fonction est transactionnelle, aucune
--   confirmation partielle.
-- Idempotent (create or replace).
-- ============================================================

create or replace function public.confirm_collection(p_reception_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  rec public.rent_receptions;
  alloc record;
  confirmed_paid integer;
  d uuid;
begin
  select * into rec from public.rent_receptions
  where id = p_reception_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'reception_not_found' using errcode = 'P0002'; end if;
  if rec.status = 'confirmed' then return; end if;
  if rec.status = 'cancelled' then raise exception 'reception_cancelled' using errcode = 'P0001'; end if;

  -- Verrouiller les échéances allouées : sérialise deux confirmations
  -- concurrentes visant la même échéance.
  perform 1
  from public.rent_dues rd
  where rd.id in (
    select a.rent_due_id from public.rent_reception_allocations a
    where a.rent_reception_id = p_reception_id
  )
  for update;

  -- Re-contrôle : pour chaque échéance, le déjà-confirmé (hors cette
  -- réception) + le montant à confirmer ne doit pas dépasser amount_due.
  for alloc in
    select a.rent_due_id, sum(a.amount_allocated) as amount_to_confirm
    from public.rent_reception_allocations a
    where a.rent_reception_id = p_reception_id
    group by a.rent_due_id
  loop
    select coalesce(sum(a2.amount_allocated), 0) into confirmed_paid
    from public.rent_reception_allocations a2
    join public.rent_receptions r2 on r2.id = a2.rent_reception_id
    where a2.rent_due_id = alloc.rent_due_id
      and r2.status = 'confirmed'
      and r2.deleted_at is null
      and r2.id <> p_reception_id;

    if confirmed_paid + alloc.amount_to_confirm >
       (select rd.amount_due from public.rent_dues rd where rd.id = alloc.rent_due_id)
    then
      raise exception 'allocation_exceeds_due_at_confirm' using errcode = 'P0001';
    end if;
  end loop;

  update public.rent_receptions
  set status = 'confirmed', confirmed_at = now()
  where id = p_reception_id;

  for d in select rent_due_id from public.rent_reception_allocations where rent_reception_id = p_reception_id
  loop
    perform private.recompute_rent_due_status(d);
  end loop;
end;
$$;

revoke all on function public.confirm_collection(uuid) from public, anon;
grant execute on function public.confirm_collection(uuid) to authenticated;
