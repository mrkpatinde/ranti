-- ============================================================
-- Migration : Confirmation locataire via RPC SECURITY DEFINER
-- Problème : la page publique /confirmer/[token] utilisait le client
--   anon pour lire rent_dues / rent_receptions. RLS bloque l'anon,
--   donc la page renvoyait toujours "introuvable" et la déclaration
--   échouait. Le flux relance -> confirmation était mort en prod.
-- Solution : deux fonctions SECURITY DEFINER, clés sur le token UUID
--   (non devinable). Aucune lecture directe des tables par l'anon.
--   Exposition minimale : uniquement les champs affichés sur la page.
-- Idempotent.
-- ============================================================

BEGIN;

-- Lecture d'une échéance par token de confirmation.
create or replace function public.get_rent_due_by_token(p_token uuid)
returns table (
  id uuid,
  amount_due integer,
  currency text,
  due_date date,
  period_start date,
  period_end date,
  status text,
  unit_name text,
  tenant_first_name text,
  declaration_status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rd.id,
    rd.amount_due,
    rd.currency,
    rd.due_date,
    rd.period_start,
    rd.period_end,
    rd.status,
    u.name as unit_name,
    t.first_name as tenant_first_name,
    (
      select rr.status
      from rent_receptions rr
      where rr.unit_id = rd.unit_id
        and rr.tenant_id = rd.tenant_id
        and rr.deleted_at is null
        and rr.status in ('draft', 'confirmed')
        and rr.received_at >= rd.period_start
        and rr.received_at < rd.period_end + interval '1 day'
      order by rr.created_at desc
      limit 1
    ) as declaration_status
  from rent_dues rd
  join units u on u.id = rd.unit_id
  join tenants t on t.id = rd.tenant_id
  where rd.confirmation_token = p_token
    and rd.deleted_at is null;
$$;

-- Déclaration locataire : crée une réception 'draft' en attente de
-- validation propriétaire. Renvoie un code de résultat texte.
create or replace function public.declare_rent_payment_by_token(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due rent_dues%rowtype;
  v_existing_status text;
begin
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

  select rr.status into v_existing_status
  from rent_receptions rr
  where rr.unit_id = v_due.unit_id
    and rr.tenant_id = v_due.tenant_id
    and rr.deleted_at is null
    and rr.status in ('draft', 'confirmed')
    and rr.received_at >= v_due.period_start
    and rr.received_at < v_due.period_end + interval '1 day'
  order by rr.created_at desc
  limit 1;

  if v_existing_status = 'confirmed' then
    return 'already_confirmed';
  end if;
  if v_existing_status = 'draft' then
    return 'already_declared';
  end if;

  insert into rent_receptions (
    landlord_id, tenant_id, unit_id,
    amount_received, currency, payment_method,
    status, received_at, note
  ) values (
    v_due.landlord_id, v_due.tenant_id, v_due.unit_id,
    v_due.amount_due, v_due.currency, 'other',
    'draft', now(),
    'Déclaré par le locataire — en attente de validation du propriétaire.'
  );

  return 'ok';
end;
$$;

-- L'anon ne peut appeler que ces deux fonctions, rien d'autre.
revoke all on function public.get_rent_due_by_token(uuid) from public;
revoke all on function public.declare_rent_payment_by_token(uuid) from public;
grant execute on function public.get_rent_due_by_token(uuid) to anon, authenticated;
grant execute on function public.declare_rent_payment_by_token(uuid) to anon, authenticated;

COMMIT;
