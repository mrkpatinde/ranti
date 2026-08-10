-- Test SQL — contrat de la colonne landlords.payment_alias (migration
-- 20260705140000). Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/landlord_payment_alias.test.sql
--
-- L'alias marchand reste le pivot de l'encaissement non-custodial : le
-- locataire paie directement le gestionnaire, Ranti n'est jamais dans la
-- chaîne de paiement (CGU art. 3). La lecture par jeton d'échéance
-- (get_rent_due_by_token) a été retirée par 20260809120100 ; les assertions
-- portant sur ce RPC ont disparu avec lui. Ce qui reste prouvé :
--   1. le gestionnaire écrit son alias et son type sous le rôle authenticated ;
--   2. l'alias s'efface (null) — rien ne s'affiche alors côté locataire ;
--   3. le type est borné à ('phone','address') par contrainte.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables (créées en postgres, exploitées ensuite sous authenticated)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('f1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'alias-test@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('f2222222-2222-2222-2222-222222222222',
        'f1111111-1111-1111-1111-111111111111',
        '+22990000030', 'Alias', 'Test');

select set_config('request.jwt.claim.sub',
                  'f1111111-1111-1111-1111-111111111111', true);

do $$
declare
  v_alias text;
  v_type  text;
begin
  set local role authenticated;

  -- 1. Écriture de l'alias par son titulaire.
  update public.landlords
  set payment_alias = '0197000000', payment_alias_type = 'phone'
  where id = 'f2222222-2222-2222-2222-222222222222';

  select payment_alias, payment_alias_type into v_alias, v_type
  from public.landlords where id = 'f2222222-2222-2222-2222-222222222222';
  if v_alias <> '0197000000' then
    raise exception 'FAIL alias: %', v_alias;
  end if;
  if v_type <> 'phone' then
    raise exception 'FAIL alias_type: %', v_type;
  end if;

  -- 2. Effacement : plus aucun alias à afficher au locataire.
  update public.landlords
  set payment_alias = null, payment_alias_type = null
  where id = 'f2222222-2222-2222-2222-222222222222';

  select payment_alias into v_alias
  from public.landlords where id = 'f2222222-2222-2222-2222-222222222222';
  if v_alias is not null then
    raise exception 'FAIL alias non effacé: %', v_alias;
  end if;

  -- 3. Type hors ('phone','address') rejeté par la contrainte.
  begin
    update public.landlords set payment_alias_type = 'crypto'
    where id = 'f2222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: type d''alias invalide accepté';
  exception when check_violation then null;  -- attendu
  end;

  reset role;
end $$;

rollback;

select 'landlord_payment_alias.test.sql: OK' as result;
