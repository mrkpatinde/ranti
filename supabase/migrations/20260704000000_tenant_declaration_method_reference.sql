-- Déclaration locataire complète : moyen de paiement + référence de transaction.
-- Le montant n'est jamais saisi par le locataire : il est fixé au reste dû
-- (pas de paiement partiel côté locataire — le montant est défini par le bail).
--
-- payment_reference est une colonne générale de rent_receptions : la référence
-- Mobile Money / virement sert aussi aux saisies proprio et opérateur à terme.

alter table public.rent_receptions
  add column if not exists payment_reference text;

-- L'ancienne signature 1-arg rendrait l'appel PostgREST ambigu face à la
-- version 3-args avec défauts : on la supprime.
drop function if exists public.declare_rent_payment_by_token(uuid);

create or replace function public.declare_rent_payment_by_token(
  p_token uuid,
  p_method text default 'other',
  p_reference text default null
)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_due rent_dues%rowtype;
  v_confirmed_paid integer;
  v_remaining integer;
  v_has_draft boolean;
  v_reception_id uuid;
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
begin
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'other') then
    return 'method_invalid';
  end if;
  if v_reference is not null and length(v_reference) > 120 then
    return 'reference_invalid';
  end if;

  select * into v_due
  from rent_dues
  where confirmation_token = p_token
    and deleted_at is null
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_due.status in ('paid', 'cancelled') then
    return 'already_processed';
  end if;

  select coalesce(sum(a.amount_allocated), 0) into v_confirmed_paid
  from rent_reception_allocations a
  join rent_receptions rr on rr.id = a.rent_reception_id
  where a.rent_due_id = v_due.id
    and rr.status = 'confirmed'
    and rr.deleted_at is null;

  v_remaining := v_due.amount_due - v_confirmed_paid;

  if v_remaining <= 0 then
    return 'already_confirmed';
  end if;

  select exists (
    select 1
    from rent_reception_allocations a
    join rent_receptions rr on rr.id = a.rent_reception_id
    where a.rent_due_id = v_due.id
      and rr.status = 'draft'
      and rr.deleted_at is null
  ) into v_has_draft;

  if v_has_draft then
    return 'already_declared';
  end if;

  insert into rent_receptions (
    landlord_id, tenant_id, unit_id,
    amount_received, currency, payment_method, payment_reference,
    status, received_at, note, recorded_by
  ) values (
    v_due.landlord_id, v_due.tenant_id, v_due.unit_id,
    v_remaining, v_due.currency, p_method, v_reference,
    'draft', now(),
    'Déclaré par le locataire — en attente de validation du propriétaire.',
    'tenant'
  )
  returning id into v_reception_id;

  insert into rent_reception_allocations (
    landlord_id, rent_reception_id, rent_due_id, amount_allocated
  ) values (
    v_due.landlord_id, v_reception_id, v_due.id, v_remaining
  );

  return 'ok';
end;
$function$;
