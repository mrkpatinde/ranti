-- Test SQL — isolation cross-tenant (owner_id → landlord_id).
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cross_tenant_isolation.test.sql
--
-- Raison d'être : c'est le test négatif explicite demandé par le brief
-- « Security Layer » (exigence #4) — prouver qu'un auth.uid() 'A' ne peut NI
-- lire NI insérer NI modifier les données d'un propriétaire 'B'. Le brief
-- parlait d'`owner_id` ; dans ce dépôt la colonne d'appartenance est
-- `landlord_id` (FK → landlords.id, PAS auth.users.id), et l'isolation est
-- déjà en place via les policies `landlord_id = private.current_landlord_id()`
-- (002_rls_policies.sql, re-pointées en schéma private par 005). Voir
-- docs/security-audit-2026-07-15.md.
--
-- ⚠️ Garde-fou (leçon 2026-07-05 / 2026-07-14) : les tests tournent en
--    postgres, qui BYPASSE la RLS. On prouve donc l'isolation en rejouant les
--    accès SOUS `set local role authenticated` avec le JWT du tenant testé —
--    jamais via has_table_privilege (les défauts legacy prod donnent le DML
--    complet, une assertion négative de grant y échouerait à tort).

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables : deux propriétaires INDÉPENDANTS A et B, chacun avec un
-- portefeuille complet. Créés en postgres (bypass RLS) ; lus/écrits ensuite
-- sous authenticated.
-- ---------------------------------------------------------------------------

-- Propriétaire A ------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('a1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'tenant-a@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('a2222222-2222-2222-2222-222222222222',
        'a1111111-1111-1111-1111-111111111111',
        '+22990000100', 'Alpha', 'Proprio');

insert into public.properties (id, landlord_id, name)
values ('a3333333-3333-3333-3333-333333333333',
        'a2222222-2222-2222-2222-222222222222', 'Cour A');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('a4444444-4444-4444-4444-444444444444',
        'a2222222-2222-2222-2222-222222222222',
        'a3333333-3333-3333-3333-333333333333', 'Ch. A1', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('a5555555-5555-5555-5555-555555555555',
        'a2222222-2222-2222-2222-222222222222', 'Ama', 'LocataireA', '+22991000100');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('a6666666-6666-6666-6666-666666666666',
        'a2222222-2222-2222-2222-222222222222',
        'a4444444-4444-4444-4444-444444444444',
        'a5555555-5555-5555-5555-555555555555',
        50000, 'XOF', 5, '2026-06-01', 'active');

-- Ledger v4 (All-Inclusive 5 %) : status 'pending' (aucune réception requise).
-- Colonnes dérivées imposées par les CHECKs (bp par défaut 500/170/100) :
--   service_fee = floor(50000*500/10000) = 2500 ; net_amount = 50000-2500 = 47500 ;
--   payin_cost  = floor(50000*170/10000) = 850  ; payout_cost = floor(47500*100/10000) = 475 ;
--   net_margin  = 2500 - 850 - 475 = 1175.
--   TVA split (tva_rate_bp 1800, migration 20260715120000_tva_split_ledger) :
--   commission_ht = floor(2500*10000/11800) = 2118 ; tva_amount = 2500 - 2118 = 382.
insert into public.payment_transactions (id, landlord_id, lease_id, provider,
                                         provider_reference, amount_received,
                                         service_fee, net_amount, payin_cost,
                                         payout_cost, net_margin, commission_ht,
                                         tva_amount, status)
values ('a8888888-8888-8888-8888-888888888888',
        'a2222222-2222-2222-2222-222222222222',
        'a6666666-6666-6666-6666-666666666666',
        'fedapay', 'A-REF-1', 50000, 2500, 47500, 850, 475, 1175, 2118, 382, 'pending');

-- Propriétaire B (miroir) ---------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('b1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'tenant-b@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('b2222222-2222-2222-2222-222222222222',
        'b1111111-1111-1111-1111-111111111111',
        '+22990000200', 'Bravo', 'Proprio');

insert into public.properties (id, landlord_id, name)
values ('b3333333-3333-3333-3333-333333333333',
        'b2222222-2222-2222-2222-222222222222', 'Cour B');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('b4444444-4444-4444-4444-444444444444',
        'b2222222-2222-2222-2222-222222222222',
        'b3333333-3333-3333-3333-333333333333', 'Ch. B1', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('b5555555-5555-5555-5555-555555555555',
        'b2222222-2222-2222-2222-222222222222', 'Bola', 'LocataireB', '+22991000200');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('b6666666-6666-6666-6666-666666666666',
        'b2222222-2222-2222-2222-222222222222',
        'b4444444-4444-4444-4444-444444444444',
        'b5555555-5555-5555-5555-555555555555',
        75000, 'XOF', 5, '2026-06-01', 'active');

--   B : service_fee 3750 ; net_amount 71250 ; payin 1275 ; payout 712 ; net_margin 1763 ;
--   commission_ht = floor(3750*10000/11800) = 3177 ; tva_amount = 3750 - 3177 = 573.
insert into public.payment_transactions (id, landlord_id, lease_id, provider,
                                         provider_reference, amount_received,
                                         service_fee, net_amount, payin_cost,
                                         payout_cost, net_margin, commission_ht,
                                         tva_amount, status)
values ('b8888888-8888-8888-8888-888888888888',
        'b2222222-2222-2222-2222-222222222222',
        'b6666666-6666-6666-6666-666666666666',
        'fedapay', 'B-REF-1', 75000, 3750, 71250, 1275, 712, 1763, 3177, 573, 'pending');

-- ---------------------------------------------------------------------------
-- BLOC A → contre B : sous le rôle authenticated, JWT = propriétaire A.
--   A ne doit NI voir, NI insérer POUR, NI modifier les lignes de B.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub',
                  'a1111111-1111-1111-1111-111111111111', true);

do $$
declare
  v_count integer;
  v_rows  integer;
  v_tbl   text;
begin
  set local role authenticated;

  -- Sanity : le pont auth.uid() → landlord_id fonctionne pour A.
  if private.current_landlord_id() <> 'a2222222-2222-2222-2222-222222222222' then
    raise exception 'FAIL setup: current_landlord_id() ne résout pas vers A';
  end if;

  -- 1) LECTURE : B invisible, A visible — sur les 4 tables du brief.
  select count(*) into v_count from public.properties
    where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if v_count <> 0 then raise exception 'FAIL read: A voit % properties de B', v_count; end if;
  select count(*) into v_count from public.properties;  -- RLS ⇒ seulement A
  if v_count <> 1 then raise exception 'FAIL read: A voit % properties (attendu 1)', v_count; end if;

  select count(*) into v_count from public.tenants
    where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if v_count <> 0 then raise exception 'FAIL read: A voit % tenants de B', v_count; end if;
  select count(*) into v_count from public.tenants;
  if v_count <> 1 then raise exception 'FAIL read: A voit % tenants (attendu 1)', v_count; end if;

  select count(*) into v_count from public.leases
    where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if v_count <> 0 then raise exception 'FAIL read: A voit % leases de B', v_count; end if;
  select count(*) into v_count from public.leases;
  if v_count <> 1 then raise exception 'FAIL read: A voit % leases (attendu 1)', v_count; end if;

  -- payment_transactions : SELECT par colonne (v4), donc count(id) — jamais count(*).
  select count(id) into v_count from public.payment_transactions
    where landlord_id = 'b2222222-2222-2222-2222-222222222222';
  if v_count <> 0 then raise exception 'FAIL read: A voit % payment_transactions de B', v_count; end if;
  select count(id) into v_count from public.payment_transactions;
  if v_count <> 1 then raise exception 'FAIL read: A voit % payment_transactions (attendu 1)', v_count; end if;

  -- 2) INSERT : with check refuse landlord_id = B (RLS ⇒ 42501, ou 23514).
  --    Tables à voie d'écriture directe authenticated : properties/tenants/leases.
  begin
    insert into public.properties (landlord_id, name)
    values ('b2222222-2222-2222-2222-222222222222', 'Squat A→B');
    raise exception 'FAIL insert: cross-tenant autorisé sur properties';
  exception
    when insufficient_privilege or check_violation then null;  -- attendu
  end;

  begin
    insert into public.tenants (landlord_id, first_name, last_name, phone)
    values ('b2222222-2222-2222-2222-222222222222', 'Intrus', 'AversB', '+22991000199');
    raise exception 'FAIL insert: cross-tenant autorisé sur tenants';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  begin
    insert into public.leases (landlord_id, unit_id, tenant_id, monthly_rent_amount,
                               currency, due_day, start_date, status)
    values ('b2222222-2222-2222-2222-222222222222',
            'b4444444-4444-4444-4444-444444444444',
            'b5555555-5555-5555-5555-555555555555',
            10000, 'XOF', 5, '2026-06-01', 'active');
    raise exception 'FAIL insert: cross-tenant autorisé sur leases';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  -- 3) UPDATE : la clause USING masque les lignes de B ⇒ 0 ligne touchée.
  for v_tbl in select unnest(array['properties', 'tenants', 'leases']) loop
    execute format(
      'update public.%I set notes = ''hijack'' where landlord_id = %L',
      v_tbl, 'b2222222-2222-2222-2222-222222222222');
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'FAIL update: A a modifié % ligne(s) de B sur %', v_rows, v_tbl;
    end if;
  end loop;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- BLOC B → contre A : symétrie, pour prouver que l'isolation n'est pas
-- unidirectionnelle. Spot-check sur une table (properties) suffit.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub',
                  'b1111111-1111-1111-1111-111111111111', true);

do $$
declare
  v_count integer;
  v_rows  integer;
begin
  set local role authenticated;

  if private.current_landlord_id() <> 'b2222222-2222-2222-2222-222222222222' then
    raise exception 'FAIL setup: current_landlord_id() ne résout pas vers B';
  end if;

  select count(*) into v_count from public.properties
    where landlord_id = 'a2222222-2222-2222-2222-222222222222';
  if v_count <> 0 then raise exception 'FAIL read symétrie: B voit % properties de A', v_count; end if;

  begin
    insert into public.properties (landlord_id, name)
    values ('a2222222-2222-2222-2222-222222222222', 'Squat B→A');
    raise exception 'FAIL insert symétrie: cross-tenant autorisé sur properties';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  update public.properties set notes = 'hijack'
    where landlord_id = 'a2222222-2222-2222-2222-222222222222';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'FAIL update symétrie: B a modifié % ligne(s) de A', v_rows;
  end if;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Garde colonne payment_transactions (v4 All-Inclusive) : le propriétaire lit
-- la vision reçu, jamais la vision comptabilité (marge Ranti). Miroir de
-- authenticated_grants.test.sql — reste vrai quels que soient les défauts prod.
-- ---------------------------------------------------------------------------
do $$
begin
  if not has_column_privilege('authenticated', 'public.payment_transactions', 'net_amount', 'SELECT') then
    raise exception 'FAIL colonne: authenticated sans SELECT sur net_amount (vision reçu)';
  end if;
  if has_column_privilege('authenticated', 'public.payment_transactions', 'net_margin', 'SELECT') then
    raise exception 'FAIL colonne: net_margin (marge Ranti) visible du propriétaire';
  end if;
end $$;

rollback;

select 'cross_tenant_isolation.test.sql: OK' as result;
