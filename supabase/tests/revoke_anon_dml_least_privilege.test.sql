-- Test SQL — retrait des écritures anon (migration 20260717120000).
-- Données JETABLES + ROLLBACK final : rien n'est persistant. Rejouable AVANT
-- l'apply prod (le test applique lui-même le revoke dans la transaction).
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/revoke_anon_dml_least_privilege.test.sql
--
-- Ce que le test prouve :
--   1. Après revoke, `anon` n'a plus INSERT/UPDATE/DELETE sur les tables métier.
--   2. Une écriture directe SOUS le rôle anon échoue (permission denied).
--   3. Les RPC token SECURITY DEFINER continuent d'écrire/lire malgré tout —
--      c'est la preuve que les flux publics locataire ne cassent pas.
--   4. `authenticated` conserve son DML (garde anti sur-révocation).

begin;

-- ---------------------------------------------------------------------------
-- 0. Applique le revoke de la migration DANS la transaction (rollback à la fin).
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- 1. Assertions de privilèges : anon SANS écriture, AVEC lecture + EXECUTE ;
--    authenticated INTACT.
-- ---------------------------------------------------------------------------
do $$
declare
  v_tbl text;
  v_write text;
begin
  -- anon ne doit plus avoir aucune écriture sur les 14 tables métier.
  foreach v_tbl in array array[
    'public.landlords','public.properties','public.units','public.tenants',
    'public.leases','public.rent_dues','public.rent_receptions',
    'public.rent_reception_allocations','public.receipts','public.reminders',
    'public.idempotency_keys','public.payment_proofs','public.audit_logs'
  ] loop
    foreach v_write in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
      if has_table_privilege('anon', v_tbl, v_write) then
        raise exception 'FAIL: anon conserve % sur %', v_write, v_tbl;
      end if;
    end loop;
  end loop;

  -- authenticated ne doit PAS être touché : l'app propriétaire écrit en direct.
  foreach v_tbl in array array[
    'public.landlords','public.properties','public.units','public.tenants',
    'public.leases','public.rent_dues','public.receipts'
  ] loop
    if not has_table_privilege('authenticated', v_tbl, 'INSERT')
       or not has_table_privilege('authenticated', v_tbl, 'UPDATE')
       or not has_table_privilege('authenticated', v_tbl, 'SELECT') then
      raise exception 'FAIL: authenticated a perdu du DML sur % (sur-révocation)', v_tbl;
    end if;
  end loop;

  -- Les RPC token restent exécutables par anon (EXECUTE ≠ grant table).
  if not has_function_privilege('anon',
       'public.declare_rent_payment_by_token(uuid,text,text)', 'execute') then
    raise exception 'FAIL: anon a perdu EXECUTE sur declare_rent_payment_by_token';
  end if;
  if not has_function_privilege('anon',
       'public.get_rent_due_by_token(uuid)', 'execute') then
    raise exception 'FAIL: anon a perdu EXECUTE sur get_rent_due_by_token';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures jetables (créées en postgres — anon ne peut plus insérer).
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('e1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'revoke-anon-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('e2222222-2222-2222-2222-222222222222',
        'e1111111-1111-1111-1111-111111111111',
        '+22990000077', 'Revoke', 'Anon');

-- generate_rent_dues scope par private.current_landlord_id() : il faut le claim.
select set_config('request.jwt.claim.sub',
                  'e1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('e3333333-3333-3333-3333-333333333333',
        'e2222222-2222-2222-2222-222222222222', 'Cour Revoke');

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('e4444444-4444-4444-4444-444444444444',
        'e2222222-2222-2222-2222-222222222222',
        'e3333333-3333-3333-3333-333333333333', 'U1', 'room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('e5555555-5555-5555-5555-555555555555',
        'e2222222-2222-2222-2222-222222222222', 'Kofi', 'Locataire', '+22991000077');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('e6666666-6666-6666-6666-666666666666',
        'e2222222-2222-2222-2222-222222222222',
        'e4444444-4444-4444-4444-444444444444',
        'e5555555-5555-5555-5555-555555555555',
        50000, 'XOF', 5, '2026-06-01', 'active');

select public.generate_rent_dues('e6666666-6666-6666-6666-666666666666');

-- ---------------------------------------------------------------------------
-- 2 & 3. Sous le rôle anon : écriture directe REFUSÉE, RPC DEFINER OK.
-- ---------------------------------------------------------------------------
do $$
declare
  v_token uuid;
  v_result text;
  v_before int;
  v_after int;
  v_denied boolean := false;
begin
  select confirmation_token into v_token
  from public.rent_dues
  where lease_id = 'e6666666-6666-6666-6666-666666666666'
  order by due_date limit 1;

  select count(*) into v_before from public.rent_receptions;

  set local role anon;

  -- (2) Écriture directe en table sous anon => permission denied (42501).
  begin
    insert into public.tenants (landlord_id, first_name, last_name, phone)
    values ('e2222222-2222-2222-2222-222222222222', 'Pirate', 'Anon', '+22990000000');
    raise exception 'FAIL: anon a pu INSERT en direct dans tenants';
  exception
    when insufficient_privilege then
      v_denied := true; -- attendu
  end;
  if not v_denied then
    raise exception 'FAIL: pas de permission denied sur INSERT anon';
  end if;

  -- (3a) RPC DEFINER en écriture : déclaration de paiement locataire par token.
  --      Prouve que la fonction écrit rent_receptions/allocations en tant que
  --      propriétaire, alors même qu'anon n'a plus aucun grant d'écriture.
  v_result := public.declare_rent_payment_by_token(v_token);
  if v_result <> 'ok' then
    raise exception 'FAIL: declare_rent_payment_by_token sous anon = % (attendu ok)', v_result;
  end if;

  -- (3b) RPC DEFINER en lecture : le locataire lit son échéance par token.
  if (select declaration_status from public.get_rent_due_by_token(v_token)) <> 'draft' then
    raise exception 'FAIL: get_rent_due_by_token sous anon ne renvoie pas draft';
  end if;

  reset role;

  -- La réception a bien été créée par la RPC DEFINER malgré le revoke anon.
  select count(*) into v_after from public.rent_receptions;
  if v_after <> v_before + 1 then
    raise exception 'FAIL: la RPC DEFINER n''a pas créé de réception (% -> %)', v_before, v_after;
  end if;
end $$;

rollback;

select 'revoke_anon_dml_least_privilege.test.sql: OK' as result;
