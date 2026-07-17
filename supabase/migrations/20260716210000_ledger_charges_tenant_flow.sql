-- ADR-023 (phase « différenciant ») — Charges variables + flux locataire.
--
-- Le grand livre s'ouvre aux débits variables (réparations, frais) et le
-- locataire devient acteur : chaque ligne affirmée par le bailleur porte un
-- token d'accès public (matrice §3 ligne 2 — une affirmation dans son propre
-- intérêt ne devient jamais certaine seule) et se valide ou se conteste par
-- lien signé, sans compte (§7, modèle ADR-013 reconduit).
--
-- Écritures côté bailleur : RPC SECURITY DEFINER avec garde d'appartenance
-- explicite (doctrine payment_transactions — la table n'a aucun grant
-- d'écriture client). Côté locataire : RPC SECURITY DEFINER clés sur le token
-- UUID, retours en chaînes de statut, grants anon — décalque exact d'ADR-013.
-- La machine à états de 20260716150000 reste seule juge des transitions.
--
-- La garde d'égalité verify_ledger_equality est restreinte à la PROJECTION
-- HÉRITÉE (loyers/règlements) : une charge validée est une vérité que le
-- modèle hérité ignore par construction — c'était tout l'objet du pivot.
--
-- Rollback : forward-only. Retour arrière = niveau applicatif (cesser
-- d'appeler ces RPC) ; aucune donnée détruite.

begin;

-- -----------------------------------------------------------------------------
-- 1. Idempotence : nouveau scope pour la création de charge (double-tap terrain).
-- -----------------------------------------------------------------------------

alter table public.idempotency_keys
  drop constraint if exists idempotency_keys_scope_check,
  add constraint idempotency_keys_scope_check
  check (scope in ('record_collection', 'bulk_onboard', 'add_lease_charge'));

-- -----------------------------------------------------------------------------
-- 2. Bailleur : ajouter une charge (réparation / frais) — naît pending + token.
-- -----------------------------------------------------------------------------

create function public.add_lease_charge(
  p_lease_id uuid,
  p_type text,
  p_amount integer,
  p_label text,
  p_due_date date default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  v_lease public.leases;
  v_id uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;

  -- Idempotence (#167) : revendiquer la clé avant tout travail.
  if p_request_id is not null then
    begin
      insert into public.idempotency_keys (landlord_id, scope, key)
      values (lid, 'add_lease_charge', p_request_id);
    exception when unique_violation then
      select (k.result->>'transaction_id')::uuid into v_id
      from public.idempotency_keys k
      where k.landlord_id = lid and k.scope = 'add_lease_charge' and k.key = p_request_id;
      if v_id is null then
        raise exception 'DUPLICATE_CHARGE' using errcode = 'P0001';
      end if;
      return v_id;
    end;
  end if;

  if p_type is null or p_type not in ('reparation', 'frais') then
    raise exception 'charge_type_invalid' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;
  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'label_required' using errcode = 'P0001';
  end if;
  if length(btrim(p_label)) > 120 then
    raise exception 'label_too_long' using errcode = 'P0001';
  end if;

  select * into v_lease from public.leases
  where id = p_lease_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'lease_not_found' using errcode = 'P0002'; end if;
  if v_lease.status <> 'active' then
    raise exception 'lease_not_active' using errcode = 'P0001';
  end if;

  insert into public.transactions (
    landlord_id, lease_id, type, direction, amount, currency, occurred_at,
    due_date, status, tenant_token, source, label
  )
  values (
    lid, p_lease_id, p_type, 'debit', p_amount, 'XOF', now(),
    p_due_date, 'pending', gen_random_uuid(), 'manuel', btrim(p_label)
  )
  returning id into v_id;

  if p_request_id is not null then
    update public.idempotency_keys
    set result = jsonb_build_object('transaction_id', v_id)
    where landlord_id = lid and scope = 'add_lease_charge' and key = p_request_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.add_lease_charge(uuid, text, integer, text, date, uuid)
  from public, anon;
grant execute on function public.add_lease_charge(uuid, text, integer, text, date, uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Bailleur : retirer une ligne jamais validée (retrait_auteur, motif requis).
--    L'indélébilité ne commence qu'à validated ; une affirmation jamais
--    reconnue se retire — elle reste lisible dans l'historique (ADR-023 §3).
-- -----------------------------------------------------------------------------

create function public.withdraw_ledger_line(p_transaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  v public.transactions;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v from public.transactions
  where id = p_transaction_id and landlord_id = lid
  for update;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;

  -- Seules les affirmations du bailleur se retirent ici : les charges. Les
  -- crédits pending (déclarations locataire, brouillons) suivent leurs flux
  -- propres (confirm/cancel_collection → miroir).
  if v.type not in ('reparation', 'frais') then
    raise exception 'not_withdrawable' using errcode = 'P0001';
  end if;
  if v.status = 'withdrawn' then return; end if;  -- idempotent
  if v.status not in ('pending', 'disputed') then
    raise exception 'transaction_terminal' using errcode = 'P0001';
  end if;

  update public.transactions
  set status = 'withdrawn', resolution = 'retrait_auteur', resolved_at = now()
  where id = v.id;

  -- Le motif vit dans l'audit (le grand livre ne s'édite pas) — ADR-006.
  insert into public.audit_logs (landlord_id, actor_landlord_id, action, entity_type, entity_id, metadata)
  values (lid, lid, 'ledger_line_withdrawn', 'transactions', v.id,
          jsonb_build_object('reason', btrim(p_reason), 'label', v.label, 'amount', v.amount));
end;
$$;

revoke all on function public.withdraw_ledger_line(uuid, text) from public, anon;
grant execute on function public.withdraw_ledger_line(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Bailleur : corriger une charge = retrait + réémission liée (remplacement).
--    La nouvelle ligne repart à pending avec un NOUVEAU token : une correction
--    n'hérite jamais de la confiance de la ligne qu'elle remplace (ADR-023 §4).
-- -----------------------------------------------------------------------------

create function public.replace_ledger_charge(
  p_transaction_id uuid,
  p_amount integer,
  p_label text,
  p_due_date date default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lid uuid := private.current_landlord_id();
  v public.transactions;
  v_new uuid;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = 'P0001';
  end if;
  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'label_required' using errcode = 'P0001';
  end if;
  if length(btrim(p_label)) > 120 then
    raise exception 'label_too_long' using errcode = 'P0001';
  end if;

  select * into v from public.transactions
  where id = p_transaction_id and landlord_id = lid
  for update;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;
  if v.type not in ('reparation', 'frais') then
    raise exception 'not_withdrawable' using errcode = 'P0001';
  end if;
  if v.status not in ('pending', 'disputed') then
    raise exception 'transaction_terminal' using errcode = 'P0001';
  end if;

  insert into public.transactions (
    landlord_id, lease_id, type, direction, amount, currency, occurred_at,
    due_date, status, tenant_token, source, label
  )
  values (
    lid, v.lease_id, v.type, 'debit', p_amount, 'XOF', now(),
    p_due_date, 'pending', gen_random_uuid(), 'manuel', btrim(p_label)
  )
  returning id into v_new;

  update public.transactions
  set status = 'withdrawn', resolution = 'remplacement',
      resolved_at = now(), replaced_by = v_new
  where id = v.id;

  insert into public.audit_logs (landlord_id, actor_landlord_id, action, entity_type, entity_id, metadata)
  values (lid, lid, 'ledger_line_replaced', 'transactions', v.id,
          jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), ''),
                             'replaced_by', v_new,
                             'old_amount', v.amount, 'new_amount', p_amount));

  return v_new;
end;
$$;

revoke all on function public.replace_ledger_charge(uuid, integer, text, date, text)
  from public, anon;
grant execute on function public.replace_ledger_charge(uuid, integer, text, date, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Locataire : lecture par token (aucune table accessible à l'anon en direct).
-- -----------------------------------------------------------------------------

create function public.get_ledger_line_by_token(p_token uuid)
returns table (
  label text,
  type text,
  amount integer,
  currency text,
  due_date date,
  occurred_at timestamptz,
  status text,
  validated_at timestamptz,
  disputed_at timestamptz,
  contest_nature text,
  contested_amount integer,
  tenant_comment text,
  resolution text,
  landlord_first_name text,
  landlord_last_name text,
  tenant_first_name text,
  tenant_last_name text,
  unit_name text
)
language sql
security definer
set search_path = ''
as $$
  select
    t.label, t.type, t.amount, t.currency, t.due_date, t.occurred_at,
    t.status, t.validated_at, t.disputed_at, t.contest_nature,
    t.contested_amount, t.tenant_comment, t.resolution,
    l.first_name, l.last_name,
    tn.first_name, tn.last_name,
    u.name
  from public.transactions t
  join public.leases le on le.id = t.lease_id
  join public.landlords l on l.id = t.landlord_id
  join public.tenants tn on tn.id = le.tenant_id
  join public.units u on u.id = le.unit_id
  where t.tenant_token = p_token
$$;

-- -----------------------------------------------------------------------------
-- 6. Locataire : valider — la dette devient certaine et indélébile (matrice d).
-- -----------------------------------------------------------------------------

create function public.validate_ledger_line_by_token(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.transactions;
begin
  select * into v from public.transactions
  where tenant_token = p_token
  for update;

  if not found then return 'not_found'; end if;
  if v.status = 'validated' then return 'already_validated'; end if;
  if v.status = 'withdrawn' then return 'withdrawn'; end if;
  if v.status = 'disputed' then return 'disputed'; end if;

  update public.transactions
  set status = 'validated', validated_by = 'tenant', validated_at = now()
  where id = v.id;

  return 'ok';
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Locataire : contester — la version du locataire, isolée, jamais écrasée.
-- -----------------------------------------------------------------------------

create function public.contest_ledger_line_by_token(
  p_token uuid,
  p_nature text,
  p_amount integer default null,
  p_comment text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.transactions;
begin
  if p_nature is null or p_nature not in ('amount', 'not_owed', 'already_paid', 'other') then
    return 'invalid_nature';
  end if;
  if p_nature = 'amount' and (p_amount is null or p_amount < 0) then
    return 'amount_invalid';
  end if;
  if p_comment is not null and length(p_comment) > 500 then
    return 'comment_too_long';
  end if;

  select * into v from public.transactions
  where tenant_token = p_token
  for update;

  if not found then return 'not_found'; end if;
  if v.status = 'validated' then return 'already_validated'; end if;
  if v.status = 'withdrawn' then return 'withdrawn'; end if;
  -- Une contestation est figée : un 2e clic n'écrase pas la 1re version (ADR-013).
  if v.status = 'disputed' then return 'already_disputed'; end if;

  update public.transactions
  set status = 'disputed',
      disputed_at = now(),
      contest_nature = p_nature,
      contested_amount = case when p_nature = 'amount' then p_amount else null end,
      tenant_comment = nullif(btrim(coalesce(p_comment, '')), '')
  where id = v.id;

  return 'ok';
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Locataire : retirer sa contestation — seule sortie disputed → validated.
-- -----------------------------------------------------------------------------

create function public.retract_contest_by_token(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.transactions;
begin
  select * into v from public.transactions
  where tenant_token = p_token
  for update;

  if not found then return 'not_found'; end if;
  if v.status = 'validated' then return 'already_validated'; end if;
  if v.status = 'withdrawn' then return 'withdrawn'; end if;
  if v.status <> 'disputed' then return 'not_disputed'; end if;

  -- L'historique de contestation reste posé (deux voix) : seul le statut sort
  -- du litige, par la résolution dédiée (machine à états 20260716150000).
  update public.transactions
  set status = 'validated', validated_by = 'tenant', validated_at = now(),
      resolution = 'retrait_contestation', resolved_at = now()
  where id = v.id;

  return 'ok';
end;
$$;

-- Grants token : l'anon ne peut appeler que ces quatre fonctions.
revoke all on function public.get_ledger_line_by_token(uuid) from public;
revoke all on function public.validate_ledger_line_by_token(uuid) from public;
revoke all on function public.contest_ledger_line_by_token(uuid, text, integer, text) from public;
revoke all on function public.retract_contest_by_token(uuid) from public;

grant execute on function public.get_ledger_line_by_token(uuid) to anon, authenticated;
grant execute on function public.validate_ledger_line_by_token(uuid) to anon, authenticated;
grant execute on function public.contest_ledger_line_by_token(uuid, text, integer, text) to anon, authenticated;
grant execute on function public.retract_contest_by_token(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. Contrat ranti-ops (ADR-022 reconduit) : ce que l'opérateur doit notifier.
--    Ranti-ops lit cette vue, envoie sur WhatsApp, trace dans son cockpit ;
--    le filet manuel wa.me reste dans l'app (le propriétaire garde la main).
-- -----------------------------------------------------------------------------

create or replace view public.ops_ledger_notifications as
select
  t.id as transaction_id,
  case when t.status = 'pending' then 'validation_requested' else 'disputed' end as kind,
  t.status,
  t.label,
  t.amount,
  t.currency,
  t.type,
  t.tenant_token,
  coalesce(t.disputed_at, t.created_at) as event_at,
  t.landlord_id,
  l.first_name as landlord_first_name,
  l.last_name as landlord_last_name,
  l.phone as landlord_phone,
  tn.first_name as tenant_first_name,
  tn.last_name as tenant_last_name,
  tn.phone as tenant_phone,
  u.name as unit_name
from public.transactions t
join public.leases le on le.id = t.lease_id
join public.landlords l on l.id = t.landlord_id
join public.tenants tn on tn.id = le.tenant_id
join public.units u on u.id = le.unit_id
where t.type in ('reparation', 'frais')
  and t.status in ('pending', 'disputed')
  and t.tenant_token is not null;

revoke all on public.ops_ledger_notifications from public, anon, authenticated;
grant select on public.ops_ledger_notifications to service_role;

-- -----------------------------------------------------------------------------
-- 10. Garde d'égalité restreinte à la projection héritée : les charges (et
--     leurs contre-passations) sont une vérité que le modèle hérité n'a pas.
-- -----------------------------------------------------------------------------

create or replace function private.verify_ledger_equality()
returns table (lease_id uuid, legacy_outstanding bigint, ledger_outstanding bigint)
language sql
security definer
set search_path = ''
as $$
  with legacy as (
    select d.lease_id,
      sum(d.amount_due)::bigint
        - coalesce(sum((
            select coalesce(sum(a.amount_allocated), 0)
            from public.rent_reception_allocations a
            join public.rent_receptions r on r.id = a.rent_reception_id
            where a.rent_due_id = d.id
              and r.status = 'confirmed'
              and r.deleted_at is null
          )), 0)::bigint as outstanding
    from public.rent_dues d
    where d.deleted_at is null and d.status <> 'cancelled'
    group by d.lease_id
  ),
  projected as (
    -- Projection héritée du grand livre : loyers, règlements, et leurs
    -- contre-passations. Les charges variables (reparation/frais) et leurs
    -- corrections vivent hors du modèle hérité — exclues de la comparaison.
    select t.*
    from public.transactions t
    left join public.transactions tgt on tgt.id = t.reversal_of
    where coalesce(tgt.type, t.type) in ('loyer', 'reglement')
  ),
  ledger as (
    select t.lease_id, (-1 * coalesce(sum(
      case when t.status = 'validated' and t.direction = 'credit' then t.amount
           when t.status = 'validated' and t.direction = 'debit' then -t.amount
           else 0 end), 0))::bigint as outstanding
    from projected t
    group by t.lease_id
  )
  select coalesce(lg.lease_id, ld.lease_id),
         coalesce(lg.outstanding, 0),
         coalesce(ld.outstanding, 0)
  from legacy lg
  full outer join ledger ld on ld.lease_id = lg.lease_id
  where coalesce(lg.outstanding, 0) <> coalesce(ld.outstanding, 0)
$$;

commit;
