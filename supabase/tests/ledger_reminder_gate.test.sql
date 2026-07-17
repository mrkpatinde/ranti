-- Test SQL transactionnel — garde compte courant sur ops_reminder_queue
-- (ADR-023, bascule des relances). Reproduit LE cas de divergence documenté :
-- un mois ancien impayé + un crédit affecté par le bailleur à un mois futur.
-- Compte courant : dette nette 0 → AUCUNE relance de retard ne doit sortir.
-- Le crédit annulé → la dette réapparaît → la relance aussi. Les rappels
-- pré-échéance (j_5) ne sont pas gatés. ROLLBACK final.
--
-- Robuste à la date d'exécution : les échéances sont posées directement avec
-- des due_date relatives à current_date (le miroir ADR-023 projette au grand
-- livre quel que soit le chemin d'écriture).

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('c1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'gate-test@ranti.local');
insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('c2222222-2222-2222-2222-222222222222',
        'c1111111-1111-1111-1111-111111111111',
        '+22990000061', 'Gate', 'Test');
select set_config('request.jwt.claim.sub',
                  'c1111111-1111-1111-1111-111111111111', false);
insert into public.properties (id, landlord_id, name)
values ('c3333333-3333-3333-3333-333333333333',
        'c2222222-2222-2222-2222-222222222222', 'Cour Gate');
insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('c4444444-4444-4444-4444-444444444444',
        'c2222222-2222-2222-2222-222222222222',
        'c3333333-3333-3333-3333-333333333333', 'Ch G', 'room', 'occupied'),
       ('c4444444-4444-4444-4444-444444444445',
        'c2222222-2222-2222-2222-222222222222',
        'c3333333-3333-3333-3333-333333333333', 'Ch H', 'room', 'occupied');
insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('c5555555-5555-5555-5555-555555555555',
        'c2222222-2222-2222-2222-222222222222', 'Gado', 'Gate', '+2290100000061');
-- Bail A (cas de divergence) et bail B (rappel pré-échéance).
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('c6666666-6666-6666-6666-666666666666',
        'c2222222-2222-2222-2222-222222222222',
        'c4444444-4444-4444-4444-444444444444',
        'c5555555-5555-5555-5555-555555555555',
        50000, 5, (date_trunc('month', current_date) - interval '3 month')::date, 'active'),
       ('c6666666-6666-6666-6666-666666666667',
        'c2222222-2222-2222-2222-222222222222',
        'c4444444-4444-4444-4444-444444444445',
        'c5555555-5555-5555-5555-555555555555',
        30000, 5, (date_trunc('month', current_date) - interval '3 month')::date, 'active');

-- Bail A : échéance ÉCHUE (mois dernier) + échéance FUTURE (mois prochain).
insert into public.rent_dues (id, landlord_id, lease_id, unit_id, tenant_id,
                              period_start, period_end, due_date, amount_due, status)
values ('cd111111-1111-1111-1111-111111111111',
        'c2222222-2222-2222-2222-222222222222',
        'c6666666-6666-6666-6666-666666666666',
        'c4444444-4444-4444-4444-444444444444',
        'c5555555-5555-5555-5555-555555555555',
        date_trunc('month', current_date - interval '1 month')::date,
        (date_trunc('month', current_date) - interval '1 day')::date,
        (date_trunc('month', current_date - interval '1 month') + interval '9 day')::date,
        50000, 'overdue'),
       ('cd111111-1111-1111-1111-111111111112',
        'c2222222-2222-2222-2222-222222222222',
        'c6666666-6666-6666-6666-666666666666',
        'c4444444-4444-4444-4444-444444444444',
        'c5555555-5555-5555-5555-555555555555',
        date_trunc('month', current_date + interval '1 month')::date,
        (date_trunc('month', current_date + interval '2 month') - interval '1 day')::date,
        (date_trunc('month', current_date + interval '1 month') + interval '9 day')::date,
        50000, 'expected');

-- Bail B : échéance dans 3 jours (fenêtre j_5), rien d'échu.
insert into public.rent_dues (id, landlord_id, lease_id, unit_id, tenant_id,
                              period_start, period_end, due_date, amount_due, status)
values ('cd222222-2222-2222-2222-222222222221',
        'c2222222-2222-2222-2222-222222222222',
        'c6666666-6666-6666-6666-666666666667',
        'c4444444-4444-4444-4444-444444444445',
        'c5555555-5555-5555-5555-555555555555',
        date_trunc('month', current_date + interval '3 day')::date,
        (date_trunc('month', current_date + interval '3 day') + interval '1 month' - interval '1 day')::date,
        current_date + 3,
        30000, 'expected');

-- ---------------------------------------------------------------------------
-- 1. Sans paiement : la relance de retard du bail A sort (impayé ledger 50 000),
--    et le rappel j_5 du bail B sort (jamais gaté).
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  v_amount bigint;
begin
  select count(*), max(ledger_overdue_amount) into n, v_amount
  from public.ops_reminder_queue
  where rent_due_id = 'cd111111-1111-1111-1111-111111111111'
    and reminder_type like 'late_%';
  if n <> 1 or v_amount <> 50000 then
    raise exception 'attendu 1 relance late avec impayé 50000, obtenu n=% impayé=%', n, v_amount using errcode='90001';
  end if;

  select count(*) into n from public.ops_reminder_queue
  where rent_due_id = 'cd222222-2222-2222-2222-222222222221' and reminder_type = 'j_5';
  if n <> 1 then
    raise exception 'attendu 1 rappel j_5 (bail B), obtenu %', n using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. LE cas de divergence : le locataire paie 50 000, le bailleur l'affecte au
--    mois FUTUR. Par échéance, le mois dernier reste « overdue » ; au compte
--    courant, la dette est nette. La relance de retard doit DISPARAÎTRE.
-- ---------------------------------------------------------------------------
do $$
declare
  rid uuid;
  n int;
  v_overdue bigint;
begin
  rid := public.record_collection(
    'c5555555-5555-5555-5555-555555555555',
    'c4444444-4444-4444-4444-444444444444',
    50000, 'mobile_money', null, 'avance affectée au mois prochain',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', 'cd111111-1111-1111-1111-111111111112',
      'amount_allocated', 50000)),
    null, 'ce111111-1111-1111-1111-111111111111');
  perform public.confirm_collection(rid);

  select overdue_amount into v_overdue from public.lease_balances
  where lease_id = 'c6666666-6666-6666-6666-666666666666';
  if v_overdue <> 0 then
    raise exception 'setup: impayé ledger=% (attendu 0 après avance)', v_overdue using errcode='90001';
  end if;

  select count(*) into n from public.ops_reminder_queue
  where lease_id = 'c6666666-6666-6666-6666-666666666666' and reminder_type like 'late_%';
  if n <> 0 then
    raise exception 'bail à jour au compte courant : % relance(s) de retard en file (attendu 0)', n using errcode='90001';
  end if;

  -- Le rappel pré-échéance du bail B, lui, est toujours là.
  select count(*) into n from public.ops_reminder_queue
  where rent_due_id = 'cd222222-2222-2222-2222-222222222221' and reminder_type = 'j_5';
  if n <> 1 then
    raise exception 'le rappel j_5 ne doit pas être gaté (obtenu %)', n using errcode='90001';
  end if;

  -- 3. L'encaissement est annulé (erreur de saisie) : la dette réapparaît au
  --    grand livre, la relance de retard revient en file.
  perform public.cancel_collection(rid, 'erreur de saisie');

  select overdue_amount into v_overdue from public.lease_balances
  where lease_id = 'c6666666-6666-6666-6666-666666666666';
  if v_overdue <> 50000 then
    raise exception 'après annulation: impayé ledger=% (attendu 50000)', v_overdue using errcode='90001';
  end if;

  select count(*) into n from public.ops_reminder_queue
  where rent_due_id = 'cd111111-1111-1111-1111-111111111111' and reminder_type like 'late_%';
  if n <> 1 then
    raise exception 'après annulation: relance de retard absente de la file' using errcode='90001';
  end if;
end $$;

rollback;
