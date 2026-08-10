-- ============================================================
-- 20260810120100 — Réparer la transition unilateral -> read du parcours jeton
-- ============================================================
-- Bug latent introduit par 20260724100000 : l'auto-garde ajoutée au WHERE de
-- la transition de lecture (`... and tenant_ack = 'unilateral'`) référence une
-- colonne qui porte le MÊME nom qu'un paramètre OUT de la fonction
-- (returns table (..., tenant_ack text, ...)). En plpgsql, une référence non
-- qualifiée qui correspond à la fois à une variable et à une colonne lève
-- `column reference "tenant_ack" is ambiguous` (42702) — à l'EXÉCUTION de ce
-- statement, donc uniquement à la PREMIÈRE ouverture d'une quittance encore
-- unilatérale. Aucun test du dépôt n'exerçait cette branche ; le test
-- revoke_anon_dml_least_privilege (réécrit pour le pivot) l'a exposée.
--
-- Correctif minimal : le corps est repris À L'IDENTIQUE de 20260724100000,
-- seul l'UPDATE gagne un alias de table (`r`) qui qualifie ses références —
-- une référence qualifiée par un alias de table n'est plus candidate à la
-- substitution de variable. Comportement voulu (auto-garde comprise)
-- inchangé.
-- ============================================================

begin;

create or replace function public.get_receipt_by_token(p_token uuid)
returns table (
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  total_amount integer,
  currency text,
  landlord_first_name text,
  landlord_last_name text,
  landlord_address text,
  landlord_city text,
  tenant_first_name text,
  tenant_last_name text,
  unit_name text,
  property_city text,
  property_address text,
  allocations jsonb,
  payment_method text,
  received_at timestamptz,
  tenant_ack text,
  tenant_read_at timestamptz,
  tenant_certified_at timestamptz,
  contested_at timestamptz,
  contest_nature text,
  contested_amount integer,
  contested_period text,
  sha256_fingerprint text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v public.receipts%rowtype;
  v_updated integer;
begin
  select * into v
  from public.receipts
  where tenant_token = p_token and deleted_at is null;

  if not found then
    return;
  end if;

  -- Premiere ouverture : unilateral -> read (indicateur produit, sans valeur
  -- juridique tacite). Auto-gardé : le WHERE re-teste l'état, un certify ou
  -- dispute intercalé n'est jamais écrasé ; on ne reflète la transition dans
  -- la ligne renvoyée que si l'UPDATE a réellement porté.
  -- Alias `r` : qualifie tenant_ack pour ne pas entrer en collision avec le
  -- paramètre OUT homonyme (fix 20260810120100).
  if v.tenant_ack = 'unilateral' then
    update public.receipts r
    set tenant_ack = 'read', tenant_read_at = now()
    where r.id = v.id and r.tenant_ack = 'unilateral';
    get diagnostics v_updated = row_count;
    if v_updated = 1 then
      v.tenant_ack := 'read';
      v.tenant_read_at := now();
    else
      select * into v
      from public.receipts
      where tenant_token = p_token and deleted_at is null;
    end if;
  end if;

  return query
  select
    v.receipt_number,
    v.kind,
    v.status,
    v.issued_at,
    v.total_amount,
    v.currency,
    l.first_name,
    l.last_name,
    l.address,
    l.city,
    v.snapshot -> 'tenant' ->> 'first_name',
    v.snapshot -> 'tenant' ->> 'last_name',
    v.snapshot -> 'unit' ->> 'name',
    v.snapshot -> 'property' ->> 'city',
    v.snapshot -> 'property' ->> 'address',
    coalesce(v.snapshot -> 'allocations', '[]'::jsonb),
    v.snapshot -> 'reception' ->> 'payment_method',
    (v.snapshot -> 'reception' ->> 'received_at')::timestamptz,
    v.tenant_ack,
    v.tenant_read_at,
    v.tenant_certified_at,
    v.contested_at,
    v.contest_nature,
    v.contested_amount,
    v.contested_period,
    v.sha256_fingerprint
  from public.landlords l
  where l.id = v.landlord_id;
end;
$function$;

-- create or replace conserve les ACL ; réaffirmées par convention maison.
revoke all on function public.get_receipt_by_token(uuid) from public;
grant execute on function public.get_receipt_by_token(uuid) to anon, authenticated;

commit;
