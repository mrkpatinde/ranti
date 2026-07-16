-- Test SQL transactionnel — Charges variables + flux locataire (ADR-023,
-- phase « différenciant »). Passe par les VRAIES RPC : add_lease_charge,
-- withdraw_ledger_line, replace_ledger_charge, et les quatre RPC token
-- (get/validate/contest/retract). Vérifie la matrice §3 ligne 2, le cycle de
-- vie du litige §4, l'idempotence, les grants anon, et que la garde d'égalité
-- reste muette (les charges vivent hors projection héritée). ROLLBACK final.
--
-- Exécution : psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ledger_charges.test.sql

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables : bailleur + bail actif (avec échéances pour que la garde
-- d'égalité compare quelque chose), et un second bailleur pour l'isolement.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('91111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charges-test@ranti.local'),
  ('98888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charges-other@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name) values
  ('92222222-2222-2222-2222-222222222222', '91111111-1111-1111-1111-111111111111', '+22990000091', 'Charge', 'Test'),
  ('99999999-9999-9999-9999-999999999999', '98888888-8888-8888-8888-888888888888', '+22990000092', 'Autre', 'Bailleur');

select set_config('request.jwt.claim.sub', '91111111-1111-1111-1111-111111111111', false);

insert into public.properties (id, landlord_id, name)
values ('93333333-3333-3333-3333-333333333333', '92222222-2222-2222-2222-222222222222', 'Cour Charges');
insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('94444444-4444-4444-4444-444444444444', '92222222-2222-2222-2222-222222222222',
        '93333333-3333-3333-3333-333333333333', 'Ch C', 'room', 'occupied');
insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('95555555-5555-5555-5555-555555555555', '92222222-2222-2222-2222-222222222222', 'Ayo', 'Charge', '+2290100000091');
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('96666666-6666-6666-6666-666666666666', '92222222-2222-2222-2222-222222222222',
        '94444444-4444-4444-4444-444444444444', '95555555-5555-5555-5555-555555555555',
        40000, 5, (date_trunc('month', current_date) - interval '1 month')::date, 'active');
select public.generate_rent_dues('96666666-6666-6666-6666-666666666666');

-- Bail inactif (draft) pour la garde lease_not_active.
insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('94444444-4444-4444-4444-444444444445', '92222222-2222-2222-2222-222222222222',
        '93333333-3333-3333-3333-333333333333', 'Ch D', 'room', 'available');
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('96666666-6666-6666-6666-666666666667', '92222222-2222-2222-2222-222222222222',
        '94444444-4444-4444-4444-444444444445', '95555555-5555-5555-5555-555555555555',
        30000, 5, current_date, 'draft');

-- ---------------------------------------------------------------------------
-- 1. Créer une charge : ligne pending + token, visible « en attente » au
--    solde, idempotente sur request_id, et vue ops peuplée.
-- ---------------------------------------------------------------------------
do $$
declare
  k uuid := 'a1111111-1111-1111-1111-111111111111';
  id1 uuid; id2 uuid;
  v public.transactions;
  n int;
  pend bigint;
begin
  id1 := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'reparation', 5000, 'Réparation serrure', null, k);
  id2 := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'reparation', 5000, 'Réparation serrure (rejeu)', null, k);
  if id1 is distinct from id2 then
    raise exception 'rejeu: charge différente (%, %)', id1, id2 using errcode='90001';
  end if;

  select * into v from public.transactions where id = id1;
  if v.status <> 'pending' or v.tenant_token is null or v.direction <> 'debit' or v.source <> 'manuel' then
    raise exception 'charge mal née: status=% token=% direction=%', v.status, v.tenant_token, v.direction using errcode='90001';
  end if;

  select pending_debits into pend from public.lease_balances
  where lease_id = '96666666-6666-6666-6666-666666666666';
  if pend <> 5000 then
    raise exception 'pending_debits=% (attendu 5000)', pend using errcode='90001';
  end if;

  select count(*) into n from public.ops_ledger_notifications
  where transaction_id = id1 and kind = 'validation_requested' and tenant_phone = '+2290100000091';
  if n <> 1 then
    raise exception 'vue ops: % ligne(s) validation_requested (attendu 1)', n using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Le locataire VALIDE par token (en anon — grants prouvés) : la dette
--    devient certaine, exigible immédiatement (due_date null), et la garde
--    d'égalité reste muette — la charge vit hors projection héritée.
-- ---------------------------------------------------------------------------
do $$
declare
  tok uuid;
  res text;
  v public.transactions;
  certain_before bigint; certain_after bigint;
  overdue_before bigint; overdue_after bigint;
begin
  select tenant_token into tok from public.transactions
  where label = 'Réparation serrure' and status = 'pending';

  select certain_balance, overdue_amount into certain_before, overdue_before
  from public.lease_balances where lease_id = '96666666-6666-6666-6666-666666666666';

  set local role anon;
  select public.validate_ledger_line_by_token(tok) into res;
  reset role;
  if res <> 'ok' then raise exception 'validate: % (attendu ok)', res using errcode='90001'; end if;

  select * into v from public.transactions where tenant_token = tok;
  if v.status <> 'validated' or v.validated_by <> 'tenant' then
    raise exception 'validate: status=% by=%', v.status, v.validated_by using errcode='90001';
  end if;

  select certain_balance, overdue_amount into certain_after, overdue_after
  from public.lease_balances where lease_id = '96666666-6666-6666-6666-666666666666';
  if certain_after <> certain_before - 5000 then
    raise exception 'solde certain % (attendu %)', certain_after, certain_before - 5000 using errcode='90001';
  end if;
  if overdue_after <> overdue_before + 5000 then
    raise exception 'impayé % (attendu % — charge sans échéance = due tout de suite)', overdue_after, overdue_before + 5000 using errcode='90001';
  end if;

  if exists (select 1 from private.verify_ledger_equality()) then
    raise exception 'garde d''égalité déclenchée par une charge validée (projection héritée mal restreinte)' using errcode='90001';
  end if;

  -- Rejeu de la validation : figée.
  set local role anon;
  select public.validate_ledger_line_by_token(tok) into res;
  reset role;
  if res <> 'already_validated' then raise exception 'revalidation: %', res using errcode='90001'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cycle du litige : contester (version isolée) → 2e contestation figée →
--    retrait de la contestation → validated avec historique deux voix, terminal.
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid; tok uuid; res text;
  v public.transactions;
begin
  cid := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'frais', 8000, 'Frais de gardiennage', null, null);
  select tenant_token into tok from public.transactions where id = cid;

  set local role anon;
  select public.contest_ledger_line_by_token(tok, 'amount', 3000, 'le gardien est venu une seule fois') into res;
  reset role;
  if res <> 'ok' then raise exception 'contest: %', res using errcode='90001'; end if;

  select * into v from public.transactions where id = cid;
  if v.status <> 'disputed' or v.contest_nature <> 'amount' or v.contested_amount <> 3000 then
    raise exception 'contest: status=% nature=% montant=%', v.status, v.contest_nature, v.contested_amount using errcode='90001';
  end if;

  -- La vue ops signale le litige.
  if not exists (select 1 from public.ops_ledger_notifications where transaction_id = cid and kind = 'disputed') then
    raise exception 'vue ops: litige non signalé' using errcode='90001';
  end if;

  -- 2e contestation : la première version n'est jamais écrasée.
  set local role anon;
  select public.contest_ledger_line_by_token(tok, 'other', null, 'nouvelle version') into res;
  reset role;
  if res <> 'already_disputed' then raise exception 're-contest: %', res using errcode='90001'; end if;
  select * into v from public.transactions where id = cid;
  if v.contest_nature <> 'amount' or v.tenant_comment <> 'le gardien est venu une seule fois' then
    raise exception 'la première contestation a été écrasée' using errcode='90001';
  end if;

  -- Retrait de la contestation : seule sortie disputed → validated.
  set local role anon;
  select public.retract_contest_by_token(tok) into res;
  reset role;
  if res <> 'ok' then raise exception 'retract: %', res using errcode='90001'; end if;

  select * into v from public.transactions where id = cid;
  if v.status <> 'validated' or v.resolution <> 'retrait_contestation'
     or v.validated_by <> 'tenant' or v.contest_nature is null then
    raise exception 'retract: status=% resolution=% historique=%', v.status, v.resolution, v.contest_nature using errcode='90001';
  end if;

  -- Terminal : plus aucune action token.
  set local role anon;
  select public.retract_contest_by_token(tok) into res;
  reset role;
  if res <> 'already_validated' then raise exception 're-retract: %', res using errcode='90001'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Retrait par l'auteur : motif requis, tracé en audit, idempotent ; le
--    token du locataire répond « withdrawn ».
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid; tok uuid; res text;
  v public.transactions;
begin
  cid := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'frais', 2000, 'Frais erronés', null, null);
  select tenant_token into tok from public.transactions where id = cid;

  begin
    perform public.withdraw_ledger_line(cid, '   ');
    raise exception 'retrait sans motif aurait dû échouer' using errcode='90001';
  exception when others then
    if sqlerrm not like '%reason_required%' then raise; end if;
  end;

  perform public.withdraw_ledger_line(cid, 'saisi sur le mauvais bail');
  select * into v from public.transactions where id = cid;
  if v.status <> 'withdrawn' or v.resolution <> 'retrait_auteur' then
    raise exception 'withdraw: status=% resolution=%', v.status, v.resolution using errcode='90001';
  end if;

  if not exists (
    select 1 from public.audit_logs
    where action = 'ledger_line_withdrawn' and entity_id = cid
      and metadata->>'reason' = 'saisi sur le mauvais bail'
  ) then
    raise exception 'motif du retrait absent de l''audit' using errcode='90001';
  end if;

  perform public.withdraw_ledger_line(cid, 'rejeu'); -- idempotent

  set local role anon;
  select public.validate_ledger_line_by_token(tok) into res;
  reset role;
  if res <> 'withdrawn' then raise exception 'token après retrait: %', res using errcode='90001'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Remplacement : l'ancienne ligne est retirée et liée (replaced_by), la
--    nouvelle repart à pending avec un NOUVEAU token.
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid; tok_old uuid; nid uuid; res text;
  v_old public.transactions; v_new public.transactions;
begin
  cid := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'reparation', 50000, 'Réparation portail', null, null);
  select tenant_token into tok_old from public.transactions where id = cid;

  set local role anon;
  select public.contest_ledger_line_by_token(tok_old, 'amount', 5000, null) into res;
  reset role;
  if res <> 'ok' then raise exception 'setup contest: %', res using errcode='90001'; end if;

  nid := public.replace_ledger_charge(cid, 5000, 'Réparation portail', null, 'erreur de saisie — un zéro de trop');

  select * into v_old from public.transactions where id = cid;
  select * into v_new from public.transactions where id = nid;

  if v_old.status <> 'withdrawn' or v_old.resolution <> 'remplacement' or v_old.replaced_by <> nid then
    raise exception 'remplacement: ancienne ligne status=% resolution=% lien=%', v_old.status, v_old.resolution, v_old.replaced_by using errcode='90001';
  end if;
  if v_new.status <> 'pending' or v_new.amount <> 5000 or v_new.tenant_token = tok_old or v_new.tenant_token is null then
    raise exception 'remplacement: nouvelle ligne status=% montant=% token identique=%',
      v_new.status, v_new.amount, (v_new.tenant_token = tok_old) using errcode='90001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Gardes : type invalide, bail inactif, bail d'un autre bailleur (404
--    sémantique), et l'anon ne peut PAS créer de charge (grant refusé).
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid;
begin
  begin
    cid := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'loyer', 1000, 'interdit', null, null);
    raise exception 'type loyer aurait dû être refusé' using errcode='90001';
  exception when others then
    if sqlerrm not like '%charge_type_invalid%' then raise; end if;
  end;

  begin
    cid := public.add_lease_charge('96666666-6666-6666-6666-666666666667', 'frais', 1000, 'bail draft', null, null);
    raise exception 'bail inactif aurait dû être refusé' using errcode='90001';
  exception when others then
    if sqlerrm not like '%lease_not_active%' then raise; end if;
  end;

  -- L'autre bailleur ne voit pas ce bail : not found, pas « interdit ».
  perform set_config('request.jwt.claim.sub', '98888888-8888-8888-8888-888888888888', true);
  begin
    cid := public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'frais', 1000, 'intrusion', null, null);
    raise exception 'bail étranger aurait dû être introuvable' using errcode='90001';
  exception when others then
    if sqlerrm not like '%lease_not_found%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', '91111111-1111-1111-1111-111111111111', true);
end $$;

do $$
begin
  set local role anon;
  begin
    perform public.add_lease_charge('96666666-6666-6666-6666-666666666666', 'frais', 1000, 'anon', null, null);
    raise exception 'l''anon aurait dû être refusé' using errcode='90001';
  exception when insufficient_privilege then
    null; -- attendu
  end;
  reset role;
end $$;

rollback;
