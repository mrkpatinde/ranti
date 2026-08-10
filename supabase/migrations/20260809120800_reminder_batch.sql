-- ============================================================
-- 20260809120800 — Relances par lot (brique 4)
-- ============================================================
-- Aujourd'hui, relancer se fait bail par bail : ouvrir l'échéance, cliquer,
-- revenir. Un bailleur avec deux logements le supporte ; une agence avec
-- soixante lots ne le fera jamais. Le geste doit devenir « je relance tous
-- mes retards du mois » en une passe.
--
-- Ranti continue de ne rien envoyer lui-même : le message part du WhatsApp du
-- gestionnaire, via un lien wa.me. C'est ce que décrivent les CGU (art. 6 :
-- Ranti « prépare et, le cas échéant, envoie ») et cela évite un contrat
-- d'opérateur, un coût par message et une dépendance externe. Ce que le
-- produit apporte ici : la file, le message pré-rédigé, et la trace.
--
-- L'enregistrement se fait en un appel pour tout le lot — sinon, soixante
-- allers-retours réseau sur une connexion de terrain.
-- ============================================================

begin;

-- ── La file de relance ──────────────────────────────────────────────────────
create or replace view public.reminder_batch as
select
  d.id                       as rent_due_id,
  d.landlord_id,
  d.lease_id,
  d.tenant_id,
  o.id                       as owner_id,
  o.display_name             as owner_name,
  pr.name                    as property_name,
  u.name                     as unit_name,
  nullif(btrim(concat_ws(' ', t.first_name, t.last_name)), '') as tenant_name,
  t.phone                    as tenant_phone,
  d.period_start,
  d.period_end,
  d.due_date,
  d.currency,
  greatest(0, d.amount_due - coalesce(paid.total, 0))::bigint as amount_remaining,
  (current_date - d.due_date)::int as days_from_due,
  case
    when current_date - d.due_date >= 3  then 'late_j_3'
    when current_date - d.due_date >= 1  then 'late_j_1'
    when d.due_date - current_date <= 1  then 'j_1'
    else 'j_5'
  end                        as reminder_type,
  d.last_reminder_at,
  d.reminder_count,
  d.confirmation_token
from public.rent_dues d
join public.leases     l  on l.id  = d.lease_id
join public.units      u  on u.id  = d.unit_id
join public.properties pr on pr.id = u.property_id
join public.tenants    t  on t.id  = d.tenant_id
left join public.owners o on o.id  = pr.owner_id
left join lateral (
  select sum(a.amount_allocated)::bigint as total
  from public.rent_reception_allocations a
  join public.rent_receptions r on r.id = a.rent_reception_id
  where a.rent_due_id = d.id and r.status = 'confirmed' and r.deleted_at is null
) paid on true
where d.deleted_at is null
  and d.status <> 'cancelled'
  and l.deleted_at is null
  and t.deleted_at is null
  and t.phone is not null
  and d.amount_due - coalesce(paid.total, 0) > 0
  -- On ne relance pas une échéance qui n'est pas encore proche : 5 jours
  -- avant l'échéance, pas avant.
  and d.due_date - current_date <= 5;

alter view public.reminder_batch set (security_invoker = true);

revoke all on public.reminder_batch from anon;
grant select on public.reminder_batch to authenticated;

comment on view public.reminder_batch is
  'File de relance du portefeuille : une ligne par échéance non soldée dont la
   date approche ou est dépassée, avec le reste dû et le canal de contact.';

-- ── Enregistrement du lot en un appel ───────────────────────────────────────
create or replace function public.log_reminder_batch(
  p_rent_due_ids uuid[],
  p_messages     jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_landlord uuid := private.current_landlord_id();
  v_logged   int  := 0;
  r          record;
begin
  if v_landlord is null then
    raise exception 'landlord_not_found' using errcode = 'P0002';
  end if;
  if p_rent_due_ids is null or cardinality(p_rent_due_ids) = 0 then
    return jsonb_build_object('logged', 0);
  end if;
  -- Garde-fou : un lot de plus de 500 relances est une erreur d'appel, pas
  -- un cas d'usage.
  if cardinality(p_rent_due_ids) > 500 then
    raise exception 'batch_too_large' using errcode = 'P0001';
  end if;

  for r in
    select b.rent_due_id, b.lease_id, b.tenant_id, b.reminder_type
    from public.reminder_batch b
    where b.rent_due_id = any(p_rent_due_ids)
      and b.landlord_id = v_landlord
  loop
    insert into public.reminder_events (
      lease_id, rent_due_id, tenant_id, landlord_id,
      reminder_type, channel, message_body, status, sent_by, sent_at
    )
    values (
      r.lease_id, r.rent_due_id, r.tenant_id, v_landlord,
      r.reminder_type, 'whatsapp_manual',
      -- message_body est NOT NULL : une relance sans message enregistré
      -- laisse une trace vide, jamais un échec d'insertion.
      coalesce(p_messages ->> r.rent_due_id::text, ''),
      'sent', 'landlord', now()
    );

    update public.rent_dues
    set last_reminder_at = now(),
        reminder_count   = coalesce(reminder_count, 0) + 1
    where id = r.rent_due_id and landlord_id = v_landlord;

    v_logged := v_logged + 1;
  end loop;

  return jsonb_build_object('logged', v_logged);
end;
$$;

revoke all on function public.log_reminder_batch(uuid[], jsonb) from public, anon;
grant execute on function public.log_reminder_batch(uuid[], jsonb) to authenticated;

-- La fonction est SECURITY INVOKER : elle écrit sous l'identité de l'appelant.
-- reminder_events n'accordait que SELECT à `authenticated` (l'écriture venait
-- du service_role). On ouvre l'INSERT, borné par une policy.
grant insert on table public.reminder_events to authenticated;

drop policy if exists reminder_events_insert_own on public.reminder_events;
create policy reminder_events_insert_own on public.reminder_events
  for insert to authenticated
  with check (
    landlord_id = private.current_landlord_id()
    -- Le seul contrôle du landlord_id laisserait écrire une trace pointant
    -- vers l'échéance d'un autre portefeuille : illisible par la victime,
    -- mais la trace perdrait sa valeur probante. On exige que l'échéance
    -- appartienne bien à l'appelant.
    and exists (
      select 1 from public.rent_dues d
      where d.id = rent_due_id
        and d.landlord_id = private.current_landlord_id()
    )
  );

commit;
