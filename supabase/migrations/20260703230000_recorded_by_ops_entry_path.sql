-- Sprint instrumentation (T1 + T4) — provenance des saisies + chemin d'écriture opérateur.
--
-- rent_receptions a désormais 3 acteurs écrivains :
--   'landlord' : record_collection (invoker, RLS via current_landlord_id)
--   'tenant'   : declare_rent_payment_by_token (SECURITY DEFINER, anon, token)
--   'operator' : ops_record_collection / ops_confirm_collection (SECURITY DEFINER,
--                service_role uniquement — cockpit ranti-ops)
-- recorded_by est écrit DANS les fonctions, jamais accepté du client.
-- Découpage RLS-safe : cœurs partagés dans private (checks explicites sur lid),
-- wrappers minces publics. Le chemin landlord reste invoker.

-- ---------------------------------------------------------------------------
-- 1. Colonnes de provenance
-- ---------------------------------------------------------------------------
alter table public.rent_receptions
  add column if not exists recorded_by text not null default 'landlord'
    constraint rent_receptions_recorded_by_check
    check (recorded_by in ('landlord', 'operator', 'tenant')),
  add column if not exists recorded_by_ref text;

-- Backfill : les déclarations locataires existantes portent la note posée par
-- declare_rent_payment_by_token — seul marqueur distinctif disponible.
update public.rent_receptions
set recorded_by = 'tenant'
where note = 'Déclaré par le locataire — en attente de validation du propriétaire.'
  and recorded_by = 'landlord';

-- ---------------------------------------------------------------------------
-- 2. Le locataire écrit 'tenant'
-- ---------------------------------------------------------------------------
create or replace function public.declare_rent_payment_by_token(p_token uuid)
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
    amount_received, currency, payment_method,
    status, received_at, note, recorded_by
  ) values (
    v_due.landlord_id, v_due.tenant_id, v_due.unit_id,
    v_remaining, v_due.currency, 'other',
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

-- ---------------------------------------------------------------------------
-- 3. Cœurs partagés (private) — checks explicites sur le landlord passé
-- ---------------------------------------------------------------------------
create or replace function private.record_collection_core(
  p_landlord_id uuid,
  p_tenant_id uuid,
  p_unit_id uuid,
  p_amount integer,
  p_method text,
  p_received_at timestamptz,
  p_note text,
  p_allocations jsonb,
  p_recorded_by text,
  p_recorded_by_ref text
)
returns uuid
language plpgsql
set search_path to ''
as $$
declare
  lid uuid := p_landlord_id;
  rid uuid;
  alloc_sum integer := 0;
  a jsonb;
  amt integer;
  due public.rent_dues;
  paid_already integer;
begin
  if lid is null then raise exception 'no_landlord' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_invalid' using errcode = 'P0001'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'other') then
    raise exception 'method_invalid' using errcode = 'P0001';
  end if;
  if p_recorded_by not in ('landlord', 'operator') then
    raise exception 'recorded_by_invalid' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'allocation_required' using errcode = 'P0001';
  end if;

  perform 1 from public.tenants where id = p_tenant_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'tenant_not_found' using errcode = 'P0002'; end if;

  perform 1 from public.units where id = p_unit_id and landlord_id = lid and deleted_at is null;
  if not found then raise exception 'unit_not_found' using errcode = 'P0002'; end if;

  for a in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb))
  loop
    amt := (a->>'amount_allocated')::int;
    if amt is null or amt <= 0 then raise exception 'allocation_invalid' using errcode = 'P0001'; end if;

    select * into due from public.rent_dues
    where id = (a->>'rent_due_id')::uuid and landlord_id = lid and deleted_at is null;
    if not found then raise exception 'due_not_found' using errcode = 'P0002'; end if;
    if due.tenant_id <> p_tenant_id then raise exception 'due_tenant_mismatch' using errcode = 'P0001'; end if;
    if due.unit_id <> p_unit_id then raise exception 'due_unit_mismatch' using errcode = 'P0001'; end if;
    if due.status = 'cancelled' then raise exception 'due_cancelled' using errcode = 'P0001'; end if;

    select coalesce(sum(al.amount_allocated), 0) into paid_already
    from public.rent_reception_allocations al
    join public.rent_receptions r on r.id = al.rent_reception_id
    where al.rent_due_id = due.id
      and r.status = 'confirmed'
      and r.deleted_at is null;

    if amt > (due.amount_due - paid_already) then
      raise exception 'allocation_exceeds_due' using errcode = 'P0001';
    end if;

    alloc_sum := alloc_sum + amt;
  end loop;

  if alloc_sum > p_amount then
    raise exception 'allocations_exceed_amount' using errcode = 'P0001';
  end if;

  insert into public.rent_receptions (
    landlord_id, tenant_id, unit_id, received_at, amount_received, currency,
    payment_method, status, note, recorded_by, recorded_by_ref
  )
  values (
    lid, p_tenant_id, p_unit_id, coalesce(p_received_at, now()), p_amount, 'XOF',
    p_method, 'draft', p_note, p_recorded_by, p_recorded_by_ref
  )
  returning id into rid;

  insert into public.rent_reception_allocations (landlord_id, rent_reception_id, rent_due_id, amount_allocated)
  select lid, rid, (el->>'rent_due_id')::uuid, (el->>'amount_allocated')::int
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as el;

  return rid;
end;
$$;

create or replace function private.confirm_collection_core(
  p_landlord_id uuid,
  p_reception_id uuid
)
returns void
language plpgsql
set search_path to ''
as $$
declare
  lid uuid := p_landlord_id;
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

  perform 1
  from public.rent_dues rd
  where rd.id in (
    select a.rent_due_id from public.rent_reception_allocations a
    where a.rent_reception_id = p_reception_id
  )
  for update;

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

-- ---------------------------------------------------------------------------
-- 4. Wrappers minces — landlord (invoker, inchangé pour les clients)
-- ---------------------------------------------------------------------------
create or replace function public.record_collection(
  p_tenant_id uuid, p_unit_id uuid, p_amount integer, p_method text,
  p_received_at timestamptz, p_note text, p_allocations jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $$
begin
  return private.record_collection_core(
    private.current_landlord_id(),
    p_tenant_id, p_unit_id, p_amount, p_method, p_received_at, p_note,
    p_allocations, 'landlord', null
  );
end;
$$;

create or replace function public.confirm_collection(p_reception_id uuid)
returns void
language plpgsql
set search_path to ''
as $$
begin
  perform private.confirm_collection_core(private.current_landlord_id(), p_reception_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Wrappers opérateur — SECURITY DEFINER, service_role uniquement
-- ---------------------------------------------------------------------------
create or replace function public.ops_record_collection(
  p_landlord_id uuid, p_tenant_id uuid, p_unit_id uuid, p_amount integer,
  p_method text, p_received_at timestamptz, p_note text, p_allocations jsonb,
  p_operator text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  rid uuid;
begin
  rid := private.record_collection_core(
    p_landlord_id, p_tenant_id, p_unit_id, p_amount, p_method,
    p_received_at, p_note, p_allocations, 'operator', p_operator
  );

  insert into public.audit_logs (landlord_id, actor_landlord_id, action, entity_type, entity_id, metadata)
  values (
    p_landlord_id, null, 'ops.collection_recorded', 'rent_reception', rid,
    jsonb_build_object('actor_type', 'operator', 'recorded_by_ref', p_operator)
  );

  return rid;
end;
$$;

create or replace function public.ops_confirm_collection(
  p_landlord_id uuid, p_reception_id uuid, p_operator text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform private.confirm_collection_core(p_landlord_id, p_reception_id);

  insert into public.audit_logs (landlord_id, actor_landlord_id, action, entity_type, entity_id, metadata)
  values (
    p_landlord_id, null, 'ops.collection_confirmed', 'rent_reception', p_reception_id,
    jsonb_build_object('actor_type', 'operator', 'recorded_by_ref', p_operator)
  );
end;
$$;

revoke all on function public.ops_record_collection(uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.ops_confirm_collection(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.record_collection_core(uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function private.confirm_collection_core(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. T4 — événements produit (connexions hors relance, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_events_landlord_created_idx
  on public.product_events(landlord_id, created_at desc);

alter table public.product_events enable row level security;
revoke all on table public.product_events from anon, authenticated;

-- Écriture uniquement via RPC scopée sur le landlord courant.
create or replace function public.log_product_event(p_event text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  lid uuid := private.current_landlord_id();
begin
  if lid is null then return; end if;
  if p_event is null or length(p_event) = 0 or length(p_event) > 64 then return; end if;
  insert into public.product_events (landlord_id, event, metadata)
  values (lid, p_event, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. T2 — métriques sprint pour le cockpit (fenêtre post-déploiement)
--    Ratio sur saisies CONFIRMÉES uniquement ; warning si des relances ont été
--    traitées sans aucune saisie opérateur sur la même fenêtre.
-- ---------------------------------------------------------------------------
create or replace view public.ops_sprint_metrics as
with window_start as (
  select greatest(now() - interval '30 days', timestamptz '2026-07-03 22:00:00+00') as t0
)
select
  (select count(*) from public.rent_receptions r, window_start w
    where r.status = 'confirmed' and r.deleted_at is null
      and r.recorded_by = 'landlord' and r.created_at >= w.t0) as landlord_entries_30d,
  (select count(*) from public.rent_receptions r, window_start w
    where r.status = 'confirmed' and r.deleted_at is null
      and r.recorded_by = 'operator' and r.created_at >= w.t0) as operator_entries_30d,
  (select count(*) from public.rent_receptions r, window_start w
    where r.status = 'confirmed' and r.deleted_at is null
      and r.recorded_by = 'tenant' and r.created_at >= w.t0) as tenant_entries_30d,
  (select count(*) from public.reminder_events re, window_start w
    where re.sent_at >= w.t0) as reminders_processed_30d,
  (select count(*) from public.product_events pe, window_start w
    where pe.event = 'login_outside_reminder' and pe.created_at >= w.t0) as logins_outside_reminder_30d;

revoke all on table public.ops_sprint_metrics from anon, authenticated;
