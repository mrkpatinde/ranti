-- Test SQL — pivot agences : mandants, import, relevé, relances, sceau.
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pivot_agences.test.sql
--
-- Raison d'être : les migrations 20260809120300 à 20260809120800 déplacent le
-- produit du bailleur particulier vers l'entreprise de gestion. Cinq
-- propriétés portent cette bascule et n'étaient couvertes par aucun test :
--
--   1. le sceau de quittance est infalsifiable par l'émetteur — c'est
--      l'argument probant vendu au mandant (CGU art. 7), et il ne vaut que si
--      le gestionnaire ne peut pas l'écrire lui-même ;
--   2. les mandants sont cloisonnés comme le reste du portefeuille — une
--      agence ne doit jamais voir le propriétaire d'une autre ;
--   3. l'import de fichier valide AVANT d'écrire, et écrit en tout-ou-rien —
--      c'est la porte d'entrée du produit pour un portefeuille existant ;
--   4. le relevé mensuel s'additionne à la main — honoraires arrondis ligne
--      par ligne, total = somme des lignes ;
--   5. la relance par lot ne sort jamais du portefeuille appelant.
--
-- ⚠️ Garde-fou (leçon 2026-07-05 / 2026-07-14) : les tests tournent en
--    postgres, qui BYPASSE la RLS. Tout ce qui touche au cloisonnement ou aux
--    verrous d'écriture est donc rejoué SOUS `set local role authenticated`
--    avec le JWT de l'agence testée.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables — deux agences indépendantes.
--
-- Agence A : un mandant (honoraires 800 bp = 8 %) avec un immeuble sous
--            mandat (un lot loué, un lot vacant) et un second immeuble détenu
--            en propre (deux lots en retard, pour les relances).
-- Agence B : un lot, qui sert de témoin d'isolement et de collision d'import.
-- ---------------------------------------------------------------------------

-- Agence A -------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('aa000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'agence-a@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000001',
        '+22990000201', 'Agence', 'Alpha');

insert into public.owners (id, landlord_id, display_name, phone, fee_rate_bp)
values ('aa000000-0000-0000-0000-000000000003',
        'aa000000-0000-0000-0000-000000000002',
        'Mandant Alpha', '+22997000001', 800);

-- Immeuble sous mandat.
insert into public.properties (id, landlord_id, name, owner_id)
values ('aa000000-0000-0000-0000-000000000010',
        'aa000000-0000-0000-0000-000000000002', 'Résidence Alpha',
        'aa000000-0000-0000-0000-000000000003');

-- Immeuble détenu en propre (owner_id null) : il ne doit JAMAIS apparaître au
-- relevé du mandant.
insert into public.properties (id, landlord_id, name)
values ('aa000000-0000-0000-0000-000000000011',
        'aa000000-0000-0000-0000-000000000002', 'Immeuble Alpha 2');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('aa000000-0000-0000-0000-000000000020', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000010', 'A1', 'apartment', 'occupied'),
       -- Lot vacant : doit figurer au relevé avec un encaissé à zéro.
       ('aa000000-0000-0000-0000-000000000021', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000010', 'A2', 'apartment', 'available'),
       ('aa000000-0000-0000-0000-000000000022', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000011', 'A3', 'room', 'occupied'),
       ('aa000000-0000-0000-0000-000000000023', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000011', 'A4', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('aa000000-0000-0000-0000-000000000030', 'aa000000-0000-0000-0000-000000000002',
        'Ama', 'Locataire', '+22991000201'),
       ('aa000000-0000-0000-0000-000000000031', 'aa000000-0000-0000-0000-000000000002',
        'Kofi', 'Retard', '+22991000202'),
       ('aa000000-0000-0000-0000-000000000032', 'aa000000-0000-0000-0000-000000000002',
        'Sena', 'Retard', '+22991000203');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('aa000000-0000-0000-0000-000000000040', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000020', 'aa000000-0000-0000-0000-000000000030',
        150000, 'XOF', 5, '2026-05-01', 'active'),
       ('aa000000-0000-0000-0000-000000000041', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000022', 'aa000000-0000-0000-0000-000000000031',
        60000, 'XOF', 5, '2026-05-01', 'active'),
       ('aa000000-0000-0000-0000-000000000042', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000023', 'aa000000-0000-0000-0000-000000000032',
        40000, 'XOF', 5, '2026-05-01', 'active');

-- Échéances posées à la main : le relevé se lit sur des périodes FIXES, il ne
-- doit pas dépendre de la date à laquelle la suite est jouée.
insert into public.rent_dues (id, landlord_id, lease_id, tenant_id, unit_id,
                              period_start, period_end, due_date, amount_due,
                              currency, status, confirmation_token)
values ('aa000000-0000-0000-0000-000000000050', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000040', 'aa000000-0000-0000-0000-000000000030',
        'aa000000-0000-0000-0000-000000000020',
        '2026-06-01', '2026-06-30', '2026-06-05', 150000, 'XOF', 'expected', gen_random_uuid()),
       ('aa000000-0000-0000-0000-000000000051', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000040', 'aa000000-0000-0000-0000-000000000030',
        'aa000000-0000-0000-0000-000000000020',
        '2026-07-01', '2026-07-31', '2026-07-05', 150000, 'XOF', 'expected', gen_random_uuid());

-- Les deux échéances en retard servent aux relances : elles sont calées sur
-- current_date pour rester dans la fenêtre de la file (J-5 et au-delà).
insert into public.rent_dues (id, landlord_id, lease_id, tenant_id, unit_id,
                              period_start, period_end, due_date, amount_due,
                              currency, status, confirmation_token)
values ('aa000000-0000-0000-0000-000000000052', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000041', 'aa000000-0000-0000-0000-000000000031',
        'aa000000-0000-0000-0000-000000000022',
        date_trunc('month', current_date)::date,
        (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
        current_date - 2, 60000, 'XOF', 'overdue', gen_random_uuid()),
       ('aa000000-0000-0000-0000-000000000053', 'aa000000-0000-0000-0000-000000000002',
        'aa000000-0000-0000-0000-000000000042', 'aa000000-0000-0000-0000-000000000032',
        'aa000000-0000-0000-0000-000000000023',
        date_trunc('month', current_date)::date,
        (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
        current_date - 2, 40000, 'XOF', 'overdue', gen_random_uuid());

-- Agence B -------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('bb000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'agence-b@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('bb000000-0000-0000-0000-000000000002',
        'bb000000-0000-0000-0000-000000000001',
        '+22990000202', 'Agence', 'Beta');

insert into public.properties (id, landlord_id, name)
values ('bb000000-0000-0000-0000-000000000010',
        'bb000000-0000-0000-0000-000000000002', 'Villa Beta');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('bb000000-0000-0000-0000-000000000020', 'bb000000-0000-0000-0000-000000000002',
        'bb000000-0000-0000-0000-000000000010', 'B1', 'house', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('bb000000-0000-0000-0000-000000000030', 'bb000000-0000-0000-0000-000000000002',
        'Bola', 'Beta', '+22991000204');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('bb000000-0000-0000-0000-000000000040', 'bb000000-0000-0000-0000-000000000002',
        'bb000000-0000-0000-0000-000000000020', 'bb000000-0000-0000-0000-000000000030',
        80000, 'XOF', 5, '2026-05-01', 'active');

insert into public.rent_dues (id, landlord_id, lease_id, tenant_id, unit_id,
                              period_start, period_end, due_date, amount_due,
                              currency, status, confirmation_token)
values ('bb000000-0000-0000-0000-000000000050', 'bb000000-0000-0000-0000-000000000002',
        'bb000000-0000-0000-0000-000000000040', 'bb000000-0000-0000-0000-000000000030',
        'bb000000-0000-0000-0000-000000000020',
        date_trunc('month', current_date)::date,
        (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
        current_date - 2, 80000, 'XOF', 'overdue', gen_random_uuid());

-- Encaissements de l'agence A, passés par la vraie RPC sous son propre rôle :
--   • juillet 2026 : 150 000 sur l'échéance de juillet — compté au relevé ;
--   • juin 2026    : 150 000 sur l'échéance de juin — HORS du mois demandé.
select set_config('request.jwt.claim.sub',
                  'aa000000-0000-0000-0000-000000000001', true);

do $$
declare
  v_reception_juillet uuid;
  v_reception_juin    uuid;
begin
  set local role authenticated;

  v_reception_juillet := public.record_collection(
    'aa000000-0000-0000-0000-000000000030'::uuid,
    'aa000000-0000-0000-0000-000000000020'::uuid,
    150000, 'cash', timestamptz '2026-07-10 09:00:00+00', 'loyer juillet',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', 'aa000000-0000-0000-0000-000000000051',
      'amount_allocated', 150000)),
    null::text  -- p_reference : lève l'ambiguïté entre les deux surcharges
  );
  perform public.confirm_collection(v_reception_juillet);

  v_reception_juin := public.record_collection(
    'aa000000-0000-0000-0000-000000000030'::uuid,
    'aa000000-0000-0000-0000-000000000020'::uuid,
    150000, 'cash', timestamptz '2026-06-10 09:00:00+00', 'loyer juin',
    jsonb_build_array(jsonb_build_object(
      'rent_due_id', 'aa000000-0000-0000-0000-000000000050',
      'amount_allocated', 150000)),
    null::text
  );
  perform public.confirm_collection(v_reception_juin);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 1. SCEAU DE QUITTANCE — la certification locataire n'est pas écrivable par
--    l'émetteur, une empreinte forgée est écrasée par le recalcul serveur, et
--    le sceau (HMAC sous secret) détecte une altération du contenu archivé.
--    Le verdict se lit comme sur /verifier : stored_fingerprint comparé à
--    computed_fingerprint (verify_receipt_integrity, 20260727120000).
--    (migration 20260809120300)
-- ---------------------------------------------------------------------------
do $$
declare
  v_reception_juin uuid;
  v_forged   uuid;
  v_ack      text;
  v_print    text;
  v_receipt  uuid;
  v_token    uuid;
  v_result   text;
  v_check    record;
begin
  select id into v_reception_juin from public.rent_receptions
  where landlord_id = 'aa000000-0000-0000-0000-000000000002'
    and note = 'loyer juin';

  set local role authenticated;

  -- 1a. INSERT direct d'une quittance « certifiée » avec une empreinte
  --     choisie : le trigger la ramène à une quittance unilatérale, et
  --     RECALCULE l'empreinte côté serveur — la valeur forgée est écrasée
  --     (l'émetteur ne connaît pas le secret, il ne peut pas la prédire).
  insert into public.receipts (
    landlord_id, rent_reception_id, receipt_number, total_amount, currency,
    status, kind, snapshot, tenant_ack, tenant_certified_at, sha256_fingerprint
  )
  values (
    'aa000000-0000-0000-0000-000000000002', v_reception_juin,
    'RNT-FORGE-0001', 150000, 'XOF', 'issued', 'receipt',
    jsonb_build_object('forged', true),
    'certified', now(), repeat('de', 32)
  )
  returning id into v_forged;

  select tenant_ack, sha256_fingerprint into v_ack, v_print
  from public.receipts where id = v_forged;

  if v_ack <> 'unilateral' then
    raise exception 'FAIL sceau: une quittance insérée en direct sort avec tenant_ack=% (attendu unilateral)', v_ack;
  end if;
  if v_print is null or v_print = repeat('de', 32) then
    raise exception 'FAIL sceau: empreinte choisie par l''émetteur conservée (=%)', v_print;
  end if;

  -- Le sceau posé par le trigger suit bien la recette serveur : le document
  -- inséré en direct reste VÉRIFIABLE (scellé à l'émission), simplement
  -- jamais certifiable par son auteur.
  select stored_fingerprint, computed_fingerprint into v_check
  from public.verify_receipt_integrity(v_forged);
  if v_check.stored_fingerprint is distinct from v_check.computed_fingerprint then
    raise exception 'FAIL sceau: l''empreinte recalculée par le trigger ne suit pas la recette unique';
  end if;

  -- 1b. UPDATE tentant de certifier après coup : refusé (42501).
  begin
    update public.receipts set tenant_ack = 'certified' where id = v_forged;
    raise exception 'FAIL sceau: UPDATE de tenant_ack accepté sous authenticated';
  exception
    when insufficient_privilege then null;  -- attendu : receipt_certification_readonly
  end;

  -- 1c. Chemin légitime : quittance émise puis certifiée PAR JETON. Le jeton
  --     ne se lit plus dans la table (revoke select sur tenant_token) : il
  --     s'obtient par la RPC journalisée receipt_share_token.
  select public.generate_receipt(r.id) into v_receipt
  from public.rent_receptions r
  where r.landlord_id = 'aa000000-0000-0000-0000-000000000002'
    and r.note = 'loyer juillet';

  begin
    select tenant_token into v_token from public.receipts where id = v_receipt;
    raise exception 'FAIL sceau: tenant_token reste lisible en direct sous authenticated';
  exception
    when insufficient_privilege then null;  -- attendu : colonne révoquée
  end;

  v_token := public.receipt_share_token(v_receipt);
  if v_token is null then
    raise exception 'FAIL sceau: receipt_share_token ne rend pas le jeton au gestionnaire';
  end if;

  v_result := public.certify_receipt_by_token(v_token);
  if v_result <> 'ok' then
    raise exception 'FAIL sceau: certify_receipt_by_token = % (attendu ok)', v_result;
  end if;

  select tenant_ack, stored_fingerprint, computed_fingerprint into v_check
  from public.verify_receipt_integrity(v_receipt);
  if v_check.tenant_ack <> 'certified' then
    raise exception 'FAIL sceau: tenant_ack=% après certification légitime (attendu certified)', v_check.tenant_ack;
  end if;
  if v_check.stored_fingerprint is distinct from v_check.computed_fingerprint then
    raise exception 'FAIL sceau: sceau invalide après certification légitime';
  end if;

  reset role;

  -- 1d. Altération du snapshot par un écrivain privilégié (postgres, hors
  --     parcours produit) : le sceau ne recolle plus.
  update public.receipts
  set snapshot = snapshot || jsonb_build_object('total_amount', 1)
  where id = v_receipt;

  select stored_fingerprint, computed_fingerprint into v_check
  from public.verify_receipt_integrity(v_receipt);
  if v_check.stored_fingerprint is not distinct from v_check.computed_fingerprint then
    raise exception 'FAIL sceau: altération du snapshot non détectée';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. ISOLATION DES MANDANTS — l'agence B ne voit ni les mandants de A, ni leur
--    clôture de mois, et ne peut pas s'en attribuer un.
--    (migration 20260809120500)
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  set local role authenticated;

  -- Sanity : A voit bien son mandant et sa ligne de clôture.
  if (select count(*) from public.owners) <> 1 then
    raise exception 'FAIL setup: A ne voit pas son unique mandant';
  end if;
  select count(*) into v_count from public.owner_month_summary
  where owner_id = 'aa000000-0000-0000-0000-000000000003';
  if v_count <> 1 then
    raise exception 'FAIL setup: owner_month_summary ne rend pas le mandant de A (% lignes)', v_count;
  end if;

  reset role;
end $$;

select set_config('request.jwt.claim.sub',
                  'bb000000-0000-0000-0000-000000000001', true);

do $$
declare
  v_count integer;
begin
  set local role authenticated;

  if private.current_landlord_id() <> 'bb000000-0000-0000-0000-000000000002' then
    raise exception 'FAIL setup: current_landlord_id() ne résout pas vers B';
  end if;

  select count(*) into v_count from public.owners;
  if v_count <> 0 then
    raise exception 'FAIL isolation: B voit % mandant(s) (attendu 0)', v_count;
  end if;

  select count(*) into v_count from public.owner_month_summary;
  if v_count <> 0 then
    raise exception 'FAIL isolation: B voit % ligne(s) de clôture de A', v_count;
  end if;

  -- with check refuse landlord_id = A (42501 par RLS, 23514 si contrainte).
  begin
    insert into public.owners (landlord_id, display_name, fee_rate_bp)
    values ('aa000000-0000-0000-0000-000000000002', 'Squat B vers A', 500);
    raise exception 'FAIL isolation: B a créé un mandant pour le compte de A';
  exception
    when insufficient_privilege or check_violation then null;  -- attendu
  end;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 3. IMPORT DE PORTEFEUILLE — la validation nomme chaque défaut, le lot vacant
--    passe, l'import est tout-ou-rien et idempotent.
--    (migration 20260809120600). Joué sous l'agence B.
-- ---------------------------------------------------------------------------
do $$
declare
  v_rows     jsonb;
  v_errors   text[];
  v_start    text := to_char(date_trunc('month', current_date), 'YYYY-MM-DD');
begin
  set local role authenticated;

  v_rows := jsonb_build_array(
    -- 1. bien sans nom
    jsonb_build_object('property_name', '', 'unit_name', 'X1'),
    -- 2. locataire renseigné mais sans téléphone
    jsonb_build_object('property_name', 'Résidence Gamma', 'unit_name', 'G1',
      'tenant_first_name', 'Ama', 'tenant_last_name', 'Sossa', 'tenant_phone', '',
      'monthly_rent_amount', '100000', 'due_day', '5', 'start_date', v_start),
    -- 3. loyer illisible
    jsonb_build_object('property_name', 'Résidence Gamma', 'unit_name', 'G2',
      'tenant_first_name', 'Kofi', 'tenant_last_name', 'Sossa',
      'tenant_phone', '+22997000012',
      'monthly_rent_amount', 'cent mille', 'due_day', '5', 'start_date', v_start),
    -- 4 et 5. même lot deux fois dans le fichier
    jsonb_build_object('property_name', 'Résidence Gamma', 'unit_name', 'G3'),
    jsonb_build_object('property_name', 'Résidence Gamma', 'unit_name', 'G3'),
    -- 6. lot déjà enregistré dans le portefeuille de B
    jsonb_build_object('property_name', 'Villa Beta', 'unit_name', 'B1'),
    -- 7. lot vacant : aucun bloc locataire, donc AUCUNE erreur
    jsonb_build_object('property_name', 'Résidence Gamma', 'unit_name', 'G9')
  );

  select v.errors into v_errors from public.validate_portfolio_import(v_rows) v where v.line = 1;
  if not ('Nom du bien manquant' = any(v_errors)) then
    raise exception 'FAIL import: bien sans nom non signalé (=%)', v_errors;
  end if;

  select v.errors into v_errors from public.validate_portfolio_import(v_rows) v where v.line = 2;
  if not ('Téléphone du locataire manquant' = any(v_errors)) then
    raise exception 'FAIL import: locataire sans téléphone non signalé (=%)', v_errors;
  end if;

  select v.errors into v_errors from public.validate_portfolio_import(v_rows) v where v.line = 3;
  if not (array_to_string(v_errors, ' ; ') like '%Loyer illisible%') then
    raise exception 'FAIL import: loyer illisible non signalé (=%)', v_errors;
  end if;

  select v.errors into v_errors from public.validate_portfolio_import(v_rows) v where v.line = 4;
  if not ('Lot en double dans le fichier' = any(v_errors)) then
    raise exception 'FAIL import: doublon de lot non signalé (=%)', v_errors;
  end if;

  select v.errors into v_errors from public.validate_portfolio_import(v_rows) v where v.line = 6;
  if not ('Lot déjà présent dans le portefeuille' = any(v_errors)) then
    raise exception 'FAIL import: collision avec le portefeuille non signalée (=%)', v_errors;
  end if;

  -- Le cas le plus courant d'un portefeuille réel : un lot vide.
  select v.errors into v_errors from public.validate_portfolio_import(v_rows) v where v.line = 7;
  if cardinality(v_errors) <> 0 then
    raise exception 'FAIL import: un lot vacant produit des erreurs (=%)', v_errors;
  end if;

  reset role;
end $$;

do $$
declare
  v_rows      jsonb;
  v_request   uuid := 'bb000000-0000-0000-0000-0000000000ff';
  v_res       jsonb;
  v_res2      jsonb;
  v_start     text := to_char(date_trunc('month', current_date), 'YYYY-MM-DD');
  v_owners    integer;
  v_props     integer;
  v_units     integer;
  v_active    integer;
  v_before_o  integer;
  v_before_p  integer;
  v_before_u  integer;
begin
  set local role authenticated;

  -- Deux lignes qui partagent le MÊME mandant et le MÊME bien : c'est le cas
  -- que l'ancien bulk_onboard_portfolio ne savait pas traiter.
  v_rows := jsonb_build_array(
    jsonb_build_object(
      'owner_name', 'Mandant Gamma', 'owner_phone', '+22997000001',
      'owner_fee_rate_bp', '700',
      'property_name', 'Résidence Gamma', 'property_city', 'Cotonou',
      'unit_name', 'G1', 'unit_type', 'apartment',
      'tenant_first_name', 'Ama', 'tenant_last_name', 'Sossa',
      'tenant_phone', '+22997000011',
      'monthly_rent_amount', '100000', 'due_day', '5', 'start_date', v_start),
    jsonb_build_object(
      'owner_name', 'Mandant Gamma', 'owner_phone', '+22997000001',
      'owner_fee_rate_bp', '700',
      'property_name', 'Résidence Gamma', 'property_city', 'Cotonou',
      'unit_name', 'G2', 'unit_type', 'apartment',
      'tenant_first_name', 'Kofi', 'tenant_last_name', 'Sossa',
      'tenant_phone', '+22997000012',
      'monthly_rent_amount', '80000', 'due_day', '5', 'start_date', v_start)
  );

  v_res := public.import_portfolio(v_rows, v_request);

  if (v_res ->> 'owners_created')::int <> 1 then
    raise exception 'FAIL import: % mandants créés pour un seul propriétaire au fichier', v_res ->> 'owners_created';
  end if;
  if (v_res ->> 'properties_created')::int <> 1 then
    raise exception 'FAIL import: % biens créés pour un seul bien au fichier', v_res ->> 'properties_created';
  end if;
  if (v_res ->> 'units_created')::int <> 2 then
    raise exception 'FAIL import: % lots créés (attendu 2)', v_res ->> 'units_created';
  end if;
  if (v_res ->> 'leases_activated')::int <> 2 then
    raise exception 'FAIL import: % baux activés (attendu 2)', v_res ->> 'leases_activated';
  end if;
  if (v_res ->> 'rent_dues_generated')::int < 2 then
    raise exception 'FAIL import: % échéances générées (attendu au moins 2)', v_res ->> 'rent_dues_generated';
  end if;

  -- Les baux sont réellement actifs (activate_lease, pas un simple insert).
  select count(*) into v_active
  from public.leases l
  join public.units u on u.id = l.unit_id
  join public.properties pr on pr.id = u.property_id
  where pr.name = 'Résidence Gamma' and l.status = 'active';
  if v_active <> 2 then
    raise exception 'FAIL import: % baux actifs après import (attendu 2)', v_active;
  end if;

  select count(*) into v_owners from public.owners where display_name = 'Mandant Gamma';
  select count(*) into v_props  from public.properties where name = 'Résidence Gamma';
  select count(*) into v_units  from public.units u
    join public.properties pr on pr.id = u.property_id where pr.name = 'Résidence Gamma';

  -- Rejeu du MÊME p_request_id : même verdict, aucune création supplémentaire.
  v_res2 := public.import_portfolio(v_rows, v_request);
  if v_res2 is distinct from v_res then
    raise exception 'FAIL import: le rejeu idempotent renvoie un autre résultat (% vs %)', v_res2, v_res;
  end if;
  if (select count(*) from public.owners where display_name = 'Mandant Gamma') <> v_owners
     or (select count(*) from public.properties where name = 'Résidence Gamma') <> v_props
     or (select count(*) from public.units u join public.properties pr on pr.id = u.property_id
         where pr.name = 'Résidence Gamma') <> v_units then
    raise exception 'FAIL import: le rejeu idempotent a recréé des lignes';
  end if;

  -- Tout-ou-rien : un fichier invalide ne laisse aucune trace.
  select count(*) into v_before_o from public.owners;
  select count(*) into v_before_p from public.properties;
  select count(*) into v_before_u from public.units;

  begin
    perform public.import_portfolio(jsonb_build_array(
      jsonb_build_object(
        'owner_name', 'Mandant Delta',
        'property_name', 'Résidence Delta', 'unit_name', 'D1',
        'tenant_first_name', 'Zo', 'tenant_last_name', 'Delta',
        'tenant_phone', '+22997000021',
        'monthly_rent_amount', '90000', 'due_day', '5', 'start_date', v_start),
      jsonb_build_object(
        -- Ligne fautive : locataire sans téléphone.
        'owner_name', 'Mandant Delta',
        'property_name', 'Résidence Delta', 'unit_name', 'D2',
        'tenant_first_name', 'Yao', 'tenant_last_name', 'Delta',
        'tenant_phone', '',
        'monthly_rent_amount', '90000', 'due_day', '5', 'start_date', v_start)
    ));
    raise exception 'FAIL import: un fichier invalide a été importé';
  exception
    when raise_exception then null;  -- attendu : validation_failed
  end;

  if (select count(*) from public.owners) <> v_before_o
     or (select count(*) from public.properties) <> v_before_p
     or (select count(*) from public.units) <> v_before_u then
    raise exception 'FAIL import: le fichier invalide a laissé une trace';
  end if;
  if exists (select 1 from public.owners where display_name = 'Mandant Delta') then
    raise exception 'FAIL import: le mandant de la première ligne a survécu à l''échec';
  end if;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 4. RELEVÉ DU MANDANT — honoraires arrondis ligne par ligne, total = somme
--    des lignes, périmètre borné au mois demandé, lot vacant présent.
--    (migration 20260809120700). Retour à l'agence A.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub',
                  'aa000000-0000-0000-0000-000000000001', true);

do $$
declare
  v_line     record;
  v_sum_fee  bigint;
  v_sum_coll bigint;
  v_lines    integer;
  v_vacant   record;
  v_stmt     jsonb;
begin
  set local role authenticated;

  -- Ligne du lot loué : 150 000 encaissés en juillet, 800 bp d'honoraires.
  select * into v_line
  from public.owner_statement_lines('aa000000-0000-0000-0000-000000000003', date '2026-07-01')
  where unit_name = 'A1';

  if v_line.collected <> 150000 then
    raise exception 'FAIL relevé: encaissé = % (attendu 150000)', v_line.collected;
  end if;
  if v_line.fee <> 12000 then
    raise exception 'FAIL relevé: honoraires = % (attendu 12000 = 150000 x 800bp)', v_line.fee;
  end if;
  if v_line.net <> 138000 then
    raise exception 'FAIL relevé: net = % (attendu 138000)', v_line.net;
  end if;

  -- Le lot vacant est PRÉSENT avec un encaissé nul — une absence de ligne se
  -- lirait comme un oubli.
  select * into v_vacant
  from public.owner_statement_lines('aa000000-0000-0000-0000-000000000003', date '2026-07-01')
  where unit_name = 'A2';
  if v_vacant.unit_id is null then
    raise exception 'FAIL relevé: le lot vacant est absent du relevé';
  end if;
  if v_vacant.collected <> 0 then
    raise exception 'FAIL relevé: lot vacant à % encaissé (attendu 0)', v_vacant.collected;
  end if;

  -- L'immeuble détenu en propre n'appartient pas au mandant.
  select count(*) into v_lines
  from public.owner_statement_lines('aa000000-0000-0000-0000-000000000003', date '2026-07-01');
  if v_lines <> 2 then
    raise exception 'FAIL relevé: % lignes (attendu 2 : les seuls lots sous mandat)', v_lines;
  end if;

  -- Le total du relevé est exactement la somme des lignes.
  select sum(l.fee), sum(l.collected) into v_sum_fee, v_sum_coll
  from public.owner_statement_lines('aa000000-0000-0000-0000-000000000003', date '2026-07-01') l;

  v_stmt := public.owner_statement('aa000000-0000-0000-0000-000000000003', date '2026-07-01');

  if (v_stmt -> 'totals' ->> 'fee')::bigint <> v_sum_fee then
    raise exception 'FAIL relevé: total honoraires % <> somme des lignes %',
      v_stmt -> 'totals' ->> 'fee', v_sum_fee;
  end if;
  if (v_stmt -> 'totals' ->> 'collected')::bigint <> v_sum_coll then
    raise exception 'FAIL relevé: total encaissé % <> somme des lignes %',
      v_stmt -> 'totals' ->> 'collected', v_sum_coll;
  end if;
  if (v_stmt -> 'totals' ->> 'net_due_to_owner')::bigint <> v_sum_coll - v_sum_fee then
    raise exception 'FAIL relevé: net à reverser % <> encaissé - honoraires',
      v_stmt -> 'totals' ->> 'net_due_to_owner';
  end if;

  -- L'encaissement de juin ne compte pas dans le relevé de juillet : il est
  -- pourtant confirmé, sur le même bail et le même mandant.
  select * into v_line
  from public.owner_statement_lines('aa000000-0000-0000-0000-000000000003', date '2026-06-01')
  where unit_name = 'A1';
  if v_line.collected <> 150000 then
    raise exception 'FAIL relevé: l''encaissement de juin est introuvable en juin (=%)', v_line.collected;
  end if;

  select * into v_line
  from public.owner_statement_lines('aa000000-0000-0000-0000-000000000003', date '2026-08-01')
  where unit_name = 'A1';
  if v_line.collected <> 0 then
    raise exception 'FAIL relevé: un encaissement hors du mois demandé est compté (=%)', v_line.collected;
  end if;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RELANCES PAR LOT — la file est bornée au portefeuille appelant, et
--    l'enregistrement du lot est tracé échéance par échéance.
--    (migration 20260809120800)
-- ---------------------------------------------------------------------------
do $$
declare
  v_count   integer;
  v_res     jsonb;
  v_events  integer;
  v_c1      integer;
  v_c2      integer;
begin
  set local role authenticated;

  -- Seules les deux échéances non soldées de A sont dans la file : les
  -- échéances de juin et juillet, soldées, en sont exclues.
  select count(*) into v_count from public.reminder_batch;
  if v_count <> 2 then
    raise exception 'FAIL relance: % échéance(s) dans la file de A (attendu 2)', v_count;
  end if;
  if exists (select 1 from public.reminder_batch
             where landlord_id <> 'aa000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL relance: la file de A contient une échéance d''un autre portefeuille';
  end if;
  if exists (select 1 from public.reminder_batch
             where rent_due_id = 'aa000000-0000-0000-0000-000000000051') then
    raise exception 'FAIL relance: une échéance soldée figure dans la file';
  end if;

  -- Enregistrement du lot : un reminder_events par échéance, compteur incrémenté.
  v_res := public.log_reminder_batch(
    array['aa000000-0000-0000-0000-000000000052'::uuid,
          'aa000000-0000-0000-0000-000000000053'::uuid],
    jsonb_build_object(
      'aa000000-0000-0000-0000-000000000052', 'Bonjour, le loyer reste dû.',
      'aa000000-0000-0000-0000-000000000053', 'Bonjour, le loyer reste dû.')
  );

  if (v_res ->> 'logged')::int <> 2 then
    raise exception 'FAIL relance: logged = % (attendu 2)', v_res ->> 'logged';
  end if;

  select count(*) into v_events from public.reminder_events
  where rent_due_id in ('aa000000-0000-0000-0000-000000000052',
                        'aa000000-0000-0000-0000-000000000053');
  if v_events <> 2 then
    raise exception 'FAIL relance: % reminder_events écrits (attendu 2)', v_events;
  end if;

  select reminder_count into v_c1 from public.rent_dues
  where id = 'aa000000-0000-0000-0000-000000000052';
  select reminder_count into v_c2 from public.rent_dues
  where id = 'aa000000-0000-0000-0000-000000000053';
  if v_c1 <> 1 or v_c2 <> 1 then
    raise exception 'FAIL relance: reminder_count = % / % (attendu 1 / 1)', v_c1, v_c2;
  end if;

  -- Échéance d'une autre agence : rien n'est écrit, rien n'est levé.
  v_res := public.log_reminder_batch(
    array['bb000000-0000-0000-0000-000000000050'::uuid],
    jsonb_build_object('bb000000-0000-0000-0000-000000000050', 'Tentative croisée')
  );
  if (v_res ->> 'logged')::int <> 0 then
    raise exception 'FAIL relance: % relance(s) enregistrée(s) sur le portefeuille de B', v_res ->> 'logged';
  end if;

  reset role;

  -- Vérification hors RLS : aucune trace côté B.
  select count(*) into v_events from public.reminder_events
  where rent_due_id = 'bb000000-0000-0000-0000-000000000050';
  if v_events <> 0 then
    raise exception 'FAIL relance: % événement(s) écrits sur l''échéance de B', v_events;
  end if;
  select reminder_count into v_c1 from public.rent_dues
  where id = 'bb000000-0000-0000-0000-000000000050';
  if coalesce(v_c1, 0) <> 0 then
    raise exception 'FAIL relance: reminder_count de B incrémenté (=%)', v_c1;
  end if;
end $$;

rollback;

select 'pivot_agences.test.sql: OK' as result;
