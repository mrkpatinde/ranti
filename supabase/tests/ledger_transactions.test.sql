-- Test SQL transactionnel — Grand Livre de Confiance, phase Expand (ADR-023).
-- Source de vérité = Postgres. Crée des données JETABLES, passe par les VRAIES
-- fonctions (generate_rent_dues, record/confirm/cancel_collection,
-- cancel_rent_due) et vérifie : miroir fidèle, égalité des soldes, machine à
-- états (terminalité, immutabilité, contre-passation bornée), RLS. ROLLBACK final.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ledger_transactions.test.sql

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('d1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ledger-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('d2222222-2222-2222-2222-222222222222',
        'd1111111-1111-1111-1111-111111111111',
        '+22990000042', 'Ledger', 'Test');

select set_config('request.jwt.claim.sub',
                  'd1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('d3333333-3333-3333-3333-333333333333',
        'd2222222-2222-2222-2222-222222222222', 'Cour Ledger');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('d4444444-4444-4444-4444-444444444444',
        'd2222222-2222-2222-2222-222222222222',
        'd3333333-3333-3333-3333-333333333333', 'Chambre L', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('d5555555-5555-5555-5555-555555555555',
        'd2222222-2222-2222-2222-222222222222', 'Sena', 'Ledger', '+2290100000042');

-- Bail démarré il y a 2 mois (jour 1 ≤ due_day) : au moins 3 échéances générées.
insert into public.leases (id, landlord_id, unit_id, tenant_id,
                           monthly_rent_amount, due_day, start_date, status)
values ('d6666666-6666-6666-6666-666666666666',
        'd2222222-2222-2222-2222-222222222222',
        'd4444444-4444-4444-4444-444444444444',
        'd5555555-5555-5555-5555-555555555555',
        40000, 5,
        (date_trunc('month', current_date) - interval '2 month')::date,
        'active');

-- ---------------------------------------------------------------------------
-- 1. generate_rent_dues → chaque échéance a son débit loyer validated(system),
--    et la garde d'égalité est à zéro.
-- ---------------------------------------------------------------------------
do $$
declare
  n_dues int;
  n_lines int;
  n_diff int;
begin
  perform public.generate_rent_dues('d6666666-6666-6666-6666-666666666666');

  select count(*) into n_dues from public.rent_dues
  where lease_id = 'd6666666-6666-6666-6666-666666666666';
  if n_dues < 3 then
    raise exception 'setup: % échéances générées (attendu >= 3)', n_dues using errcode='90001';
  end if;

  select count(*) into n_lines from public.transactions
  where lease_id = 'd6666666-6666-6666-6666-666666666666'
    and type = 'loyer' and status = 'validated' and validated_by = 'system'
    and source = 'genere_par_bail';
  if n_lines <> n_dues then
    raise exception 'miroir: % lignes loyer pour % échéances', n_lines, n_dues using errcode='90001';
  end if;

  select count(*) into n_diff from private.verify_ledger_equality();
  if n_diff <> 0 then
    raise exception 'égalité: % bail/baux en écart après génération', n_diff using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Encaissement : brouillon = crédit pending (hors solde certain) ;
--    confirmation = crédit validated ; égalité maintenue.
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  rid uuid;
  certain_before bigint;
  certain_after bigint;
  pend bigint;
begin
  select * into v_due from public.rent_dues
  where lease_id = 'd6666666-6666-6666-6666-666666666666'
  order by due_date asc limit 1;

  select certain_balance into certain_before from public.lease_balances
  where lease_id = 'd6666666-6666-6666-6666-666666666666';

  rid := public.record_collection(
    'd5555555-5555-5555-5555-555555555555',
    'd4444444-4444-4444-4444-444444444444',
    40000, 'cash', null, 'loyer du mois',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', v_due.id, 'amount_allocated', 40000)),
    null, 'e1111111-1111-1111-1111-111111111111');

  select pending_credits, certain_balance into pend, certain_after
  from public.lease_balances
  where lease_id = 'd6666666-6666-6666-6666-666666666666';
  if pend <> 40000 then
    raise exception 'brouillon: pending_credits=% (attendu 40000)', pend using errcode='90001';
  end if;
  if certain_after <> certain_before then
    raise exception 'brouillon: le solde certain a bougé (%->%)', certain_before, certain_after using errcode='90001';
  end if;

  perform public.confirm_collection(rid);

  select pending_credits, certain_balance into pend, certain_after
  from public.lease_balances
  where lease_id = 'd6666666-6666-6666-6666-666666666666';
  if pend <> 0 then
    raise exception 'confirmation: pending_credits=% (attendu 0)', pend using errcode='90001';
  end if;
  if certain_after <> certain_before + 40000 then
    raise exception 'confirmation: solde certain % (attendu %)', certain_after, certain_before + 40000 using errcode='90001';
  end if;

  if exists (select 1 from private.verify_ledger_equality()) then
    raise exception 'égalité rompue après confirmation' using errcode='90001';
  end if;

  -- La ligne miroir est bien validée par le bailleur (déclaration contre son
  -- propre intérêt — matrice ligne 4).
  if not exists (
    select 1 from public.transactions
    where legacy_ref like 'alloc:%' and status = 'validated'
      and validated_by = 'landlord' and source = 'manuel'
      and lease_id = 'd6666666-6666-6666-6666-666666666666'
  ) then
    raise exception 'ligne de crédit validated(landlord) introuvable' using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Annulation d'un encaissement confirmé (ADR-005) → contre-passation
--    validée, motif repris, égalité maintenue. (Phase Expand : le miroir suit
--    la vérité héritée ; la validation locataire de la matrice ligne 7
--    s'appliquera à la bascule, quand le flux locataire existera.)
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  rid uuid;
  certain_before bigint;
  certain_after bigint;
begin
  select d.* into v_due from public.rent_dues d
  where d.lease_id = 'd6666666-6666-6666-6666-666666666666' and d.status <> 'paid'
  order by d.due_date asc limit 1;

  rid := public.record_collection(
    'd5555555-5555-5555-5555-555555555555',
    'd4444444-4444-4444-4444-444444444444',
    10000, 'mobile_money', null, 'acompte à annuler',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', v_due.id, 'amount_allocated', 10000)),
    null, 'e2222222-2222-2222-2222-222222222222');
  perform public.confirm_collection(rid);

  select certain_balance into certain_before from public.lease_balances
  where lease_id = 'd6666666-6666-6666-6666-666666666666';

  perform public.cancel_collection(rid, 'erreur de saisie');

  select certain_balance into certain_after from public.lease_balances
  where lease_id = 'd6666666-6666-6666-6666-666666666666';
  if certain_after <> certain_before - 10000 then
    raise exception 'annulation: solde certain % (attendu %)', certain_after, certain_before - 10000 using errcode='90001';
  end if;

  if not exists (
    select 1 from public.transactions
    where type = 'contre_passation' and direction = 'debit'
      and label like 'Encaissement annulé — erreur de saisie'
      and lease_id = 'd6666666-6666-6666-6666-666666666666'
  ) then
    raise exception 'contre-passation d''encaissement introuvable' using errcode='90001';
  end if;

  if exists (select 1 from private.verify_ledger_equality()) then
    raise exception 'égalité rompue après annulation d''encaissement' using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Annulation d'un brouillon → retrait par l'auteur (withdrawn), jamais de
--    contre-passation (la ligne n'a jamais été certaine).
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
  rid uuid;
  st text;
  res text;
begin
  select d.* into v_due from public.rent_dues d
  where d.lease_id = 'd6666666-6666-6666-6666-666666666666' and d.status <> 'paid'
  order by d.due_date asc limit 1;

  rid := public.record_collection(
    'd5555555-5555-5555-5555-555555555555',
    'd4444444-4444-4444-4444-444444444444',
    5000, 'cash', null, 'brouillon à retirer',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', v_due.id, 'amount_allocated', 5000)),
    null, 'e3333333-3333-3333-3333-333333333333');

  perform public.cancel_collection(rid, 'brouillon abandonné');

  select t.status, t.resolution into st, res from public.transactions t
  where t.legacy_ref = 'alloc:' || (
    select a.id from public.rent_reception_allocations a where a.rent_reception_id = rid);
  if st is distinct from 'withdrawn' or res is distinct from 'retrait_auteur' then
    raise exception 'brouillon annulé: status=% resolution=% (attendu withdrawn/retrait_auteur)', st, res using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Annulation d'une échéance → contre-passation avec motif, égalité maintenue.
-- ---------------------------------------------------------------------------
do $$
declare
  v_due public.rent_dues;
begin
  select d.* into v_due from public.rent_dues d
  where d.lease_id = 'd6666666-6666-6666-6666-666666666666'
    and d.status in ('expected', 'overdue')
    and not exists (select 1 from public.rent_reception_allocations a where a.rent_due_id = d.id)
  order by d.due_date desc limit 1;
  if v_due.id is null then
    raise exception 'setup: aucune échéance annulable' using errcode='90001';
  end if;

  perform public.cancel_rent_due(v_due.id, 'logement libéré');

  if not exists (
    select 1 from public.transactions
    where legacy_ref = 'due:' || v_due.id || ':cancel'
      and type = 'contre_passation' and direction = 'credit'
      and label = 'Échéance annulée — logement libéré'
  ) then
    raise exception 'contre-passation d''échéance introuvable' using errcode='90001';
  end if;

  if exists (select 1 from private.verify_ledger_equality()) then
    raise exception 'égalité rompue après annulation d''échéance' using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Impayé de la vue = sémantique héritée (débits certains échus − crédits
--    certains, plancher zéro), quel que soit le jour d'exécution.
-- ---------------------------------------------------------------------------
do $$
declare
  v_view bigint;
  v_legacy bigint;
begin
  select overdue_amount into v_view from public.lease_balances
  where lease_id = 'd6666666-6666-6666-6666-666666666666';

  select greatest(0,
    coalesce(sum(case when b.due_date < current_date then b.amount_due else 0 end), 0)
    - coalesce(sum(b.amount_paid), 0)
  ) into v_legacy
  from public.rent_due_balances b
  where b.lease_id = 'd6666666-6666-6666-6666-666666666666'
    and b.status <> 'cancelled' and b.deleted_at is null;

  if v_view is distinct from v_legacy then
    raise exception 'impayé: vue=% legacy=%', v_view, v_legacy using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6bis. Annuler une échéance FUTURE ne réduit pas l'impayé d'aujourd'hui :
--       la contre-passation hérite de l'exigibilité de sa cible. Bail démarrant
--       le mois prochain → une échéance strictement future, annulée aussitôt.
-- ---------------------------------------------------------------------------
insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'd2222222-2222-2222-2222-222222222222',
        'd3333333-3333-3333-3333-333333333333', 'Chambre F', 'room', 'occupied');
insert into public.leases (id, landlord_id, unit_id, tenant_id,
                           monthly_rent_amount, due_day, start_date, status)
values ('dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'd2222222-2222-2222-2222-222222222222',
        'daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'd5555555-5555-5555-5555-555555555555',
        30000, 28,
        (date_trunc('month', current_date) + interval '1 month')::date,
        'active');

do $$
declare
  v_due public.rent_dues;
  v_certain bigint;
  v_overdue bigint;
begin
  perform public.generate_rent_dues('dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

  select * into v_due from public.rent_dues
  where lease_id = 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  order by due_date asc limit 1;
  if v_due.id is null or v_due.due_date <= current_date then
    raise exception 'setup 6bis: échéance future attendue (due_date=%)', v_due.due_date using errcode='90001';
  end if;

  perform public.cancel_rent_due(v_due.id, 'bail replanifié');

  select certain_balance, overdue_amount into v_certain, v_overdue
  from public.lease_balances
  where lease_id = 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if v_certain <> 0 then
    raise exception '6bis: solde certain=% (attendu 0 après annulation)', v_certain using errcode='90001';
  end if;
  if v_overdue <> 0 then
    raise exception '6bis: impayé=% (attendu 0 — l''échéance annulée était future)', v_overdue using errcode='90001';
  end if;

  if exists (select 1 from private.verify_ledger_equality()) then
    raise exception '6bis: égalité rompue' using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Machine à états — terminalité, immutabilité, naissances et transitions.
-- ---------------------------------------------------------------------------
do $$
declare
  v_line uuid;
  v_rep uuid;
begin
  select id into v_line from public.transactions
  where lease_id = 'd6666666-6666-6666-6666-666666666666' and status = 'validated'
  limit 1;

  -- 7a. Une ligne validée est terminale.
  begin
    update public.transactions set status = 'withdrawn',
      resolution = 'retrait_auteur', resolved_at = now() where id = v_line;
    raise exception 'update d''une ligne validée aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%transaction_terminal%' then raise; end if;
  end;

  -- 7b. Aucune suppression, jamais.
  begin
    delete from public.transactions where id = v_line;
    raise exception 'delete aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%transaction_no_delete%' then raise; end if;
  end;

  -- 7c. Une ligne ne naît ni disputed ni withdrawn.
  begin
    insert into public.transactions (landlord_id, lease_id, type, direction,
      amount, status, disputed_at, contest_nature, source, label)
    values ('d2222222-2222-2222-2222-222222222222',
            'd6666666-6666-6666-6666-666666666666',
            'frais', 'debit', 1000, 'disputed', now(), 'other', 'manuel', 'naissance interdite');
    raise exception 'naissance disputed aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%transaction_invalid_birth_status%' then raise; end if;
  end;

  -- 7d. Cycle complet d'un débit variable (préfiguration phase différenciant) :
  --     pending → disputed → validated (retrait de contestation) → terminal.
  insert into public.transactions (id, landlord_id, lease_id, type, direction,
    amount, status, source, label)
  values ('e7777777-7777-7777-7777-777777777777',
          'd2222222-2222-2222-2222-222222222222',
          'd6666666-6666-6666-6666-666666666666',
          'reparation', 'debit', 5000, 'pending', 'manuel', 'Réparation serrure');
  v_rep := 'e7777777-7777-7777-7777-777777777777';

  update public.transactions
  set status = 'disputed', disputed_at = now(), contest_nature = 'amount',
      contested_amount = 2000, tenant_comment = 'la serrure coûtait 2000'
  where id = v_rep;

  -- disputed → validated exige resolution = retrait_contestation.
  begin
    update public.transactions
    set status = 'validated', validated_by = 'tenant', validated_at = now()
    where id = v_rep;
    raise exception 'sortie de litige sans retrait aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%transaction_invalid_transition%' then raise; end if;
  end;

  update public.transactions
  set status = 'validated', validated_by = 'tenant', validated_at = now(),
      resolution = 'retrait_contestation', resolved_at = now()
  where id = v_rep;

  -- L'historique de contestation survit (deux voix), la ligne est terminale.
  if not exists (
    select 1 from public.transactions
    where id = v_rep and status = 'validated' and contest_nature = 'amount'
  ) then
    raise exception 'l''historique de contestation a été perdu' using errcode='90001';
  end if;
  begin
    update public.transactions set tenant_comment = 'modif interdite' where id = v_rep;
    raise exception 'ligne sortie de litige aurait dû être terminale' using errcode='90001';
  exception when others then
    if sqlerrm not like '%transaction_terminal%' then raise; end if;
  end;

  -- 7e. Contre-passation bornée : jamais plus que la cible.
  begin
    insert into public.transactions (landlord_id, lease_id, type, direction,
      amount, status, validated_by, validated_at, reversal_of, source, label)
    values ('d2222222-2222-2222-2222-222222222222',
            'd6666666-6666-6666-6666-666666666666',
            'contre_passation', 'credit', 6000, 'validated', 'landlord', now(),
            v_rep, 'manuel', 'sur-contre-passation');
    raise exception 'sur-contre-passation aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%reversal_exceeds_target%' then raise; end if;
  end;

  -- 7f. Contre-passation dans le même sens que la cible : refusée.
  begin
    insert into public.transactions (landlord_id, lease_id, type, direction,
      amount, status, validated_by, validated_at, reversal_of, source, label)
    values ('d2222222-2222-2222-2222-222222222222',
            'd6666666-6666-6666-6666-666666666666',
            'contre_passation', 'debit', 5000, 'validated', 'landlord', now(),
            v_rep, 'manuel', 'mauvais sens');
    raise exception 'contre-passation même sens aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%reversal_same_direction%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 8. RLS : un autre propriétaire ne voit aucune ligne du grand livre.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('d8888888-8888-8888-8888-888888888888',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ledger-other@ranti.local');
insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('d9999999-9999-9999-9999-999999999999',
        'd8888888-8888-8888-8888-888888888888',
        '+22990000043', 'Autre', 'Bailleur');

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub',
                     'd8888888-8888-8888-8888-888888888888', true);
  set local role authenticated;
  select count(*) into n from public.transactions;
  reset role;
  if n <> 0 then
    raise exception 'RLS: un autre bailleur voit % ligne(s)', n using errcode='90001';
  end if;
  perform set_config('request.jwt.claim.sub',
                     'd1111111-1111-1111-1111-111111111111', true);
end $$;

rollback;
