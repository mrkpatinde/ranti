-- Test SQL transactionnel — cœur transactionnel Kkiapay (ADR-018 v2).
-- Données JETABLES + ROLLBACK final : rien n'est persistant.
--
-- Exécution (jamais destructif) : via MCP execute_sql, ou en local :
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/payment_transactions.test.sql
--
-- ⚠️ Les assertions de GRANTS (bloc 8) sont le garde-fou de la leçon 2026-07-05 :
--    les tests tournent en postgres et ne "voient" pas un GRANT manquant —
--    on interroge donc explicitement has_function_privilege / role_table_grants.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures jetables : landlord + bail actif 60 000 FCFA + échéance ouverte,
-- et un second landlord pour la garde d'appartenance de verify.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('b1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'kkiapay-test@ranti.local'),
       ('c1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'kkiapay-other@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('b2222222-2222-2222-2222-222222222222',
        'b1111111-1111-1111-1111-111111111111',
        '+22990000002', 'Kkiapay', 'Test'),
       ('c2222222-2222-2222-2222-222222222222',
        'c1111111-1111-1111-1111-111111111111',
        '+22990000003', 'Autre', 'Proprio');

select set_config('request.jwt.claim.sub',
                  'b1111111-1111-1111-1111-111111111111', true);

insert into public.properties (id, landlord_id, name)
values ('b3333333-3333-3333-3333-333333333333',
        'b2222222-2222-2222-2222-222222222222', 'Cour Kkiapay');

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('b4444444-4444-4444-4444-444444444444',
        'b2222222-2222-2222-2222-222222222222',
        'b3333333-3333-3333-3333-333333333333', 'Ch. 1', 'room', 'occupied');

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('b5555555-5555-5555-5555-555555555555',
        'b2222222-2222-2222-2222-222222222222', 'Awa', 'Locataire', '+22991000001');

insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('b6666666-6666-6666-6666-666666666666',
        'b2222222-2222-2222-2222-222222222222',
        'b4444444-4444-4444-4444-444444444444',
        'b5555555-5555-5555-5555-555555555555',
        60000, 'XOF', 5, '2026-06-01', 'active');

insert into public.rent_dues (id, landlord_id, lease_id, tenant_id, unit_id,
                              period_start, period_end, due_date, amount_due,
                              currency, status, confirmation_token)
values ('b7777777-7777-7777-7777-777777777777',
        'b2222222-2222-2222-2222-222222222222',
        'b6666666-6666-6666-6666-666666666666',
        'b5555555-5555-5555-5555-555555555555',
        'b4444444-4444-4444-4444-444444444444',
        '2026-07-01', '2026-07-31', '2026-07-05', 60000, 'XOF', 'expected',
        gen_random_uuid());

-- Bail inactif (draft) pour le rejet lease_not_active.
insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('b4444444-4444-4444-4444-444444444445',
        'b2222222-2222-2222-2222-222222222222',
        'b3333333-3333-3333-3333-333333333333', 'Ch. 2', 'room');
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount,
                           currency, due_day, start_date, status)
values ('b6666666-6666-6666-6666-666666666667',
        'b2222222-2222-2222-2222-222222222222',
        'b4444444-4444-4444-4444-444444444445',
        'b5555555-5555-5555-5555-555555555555',
        45000, 'XOF', 5, '2026-06-01', 'draft');

do $$
declare
  v_lease uuid := 'b6666666-6666-6666-6666-666666666666';
  v_lease_draft uuid := 'b6666666-6666-6666-6666-666666666667';
  v_landlord uuid := 'b2222222-2222-2222-2222-222222222222';
  v_due uuid := 'b7777777-7777-7777-7777-777777777777';
  v_fees record;
  v_ing record;
  v_ing2 record;
  v_tx public.payment_transactions;
  v_rec public.rent_receptions;
  v_reception uuid;
  v_count integer;
  v_ok boolean;
  v_r record;
begin
  -- =========================================================================
  -- 1. Frais deux composants (180 + 120 bp) + CHECKs inviolables
  -- =========================================================================
  select * into v_fees from private.compute_payment_fees(100000, 180, 120);
  if v_fees.psp_fee <> 1800 or v_fees.platform_fee <> 1200 or v_fees.net_amount <> 97000 then
    raise exception 'FAIL fees 100000: % % %', v_fees.psp_fee, v_fees.platform_fee, v_fees.net_amount;
  end if;

  select * into v_fees from private.compute_payment_fees(6667, 180, 120);
  if v_fees.psp_fee <> 120 or v_fees.platform_fee <> 80 or v_fees.net_amount <> 6467 then
    raise exception 'FAIL fees 6667: % % %', v_fees.psp_fee, v_fees.platform_fee, v_fees.net_amount;
  end if;

  select * into v_fees from private.compute_payment_fees(33, 180, 120);
  if v_fees.psp_fee <> 0 or v_fees.platform_fee <> 0 or v_fees.net_amount <> 33 then
    raise exception 'FAIL fees 33: % % %', v_fees.psp_fee, v_fees.platform_fee, v_fees.net_amount;
  end if;

  -- Gardes d'entrée de compute_payment_fees : montant nul/négatif/null,
  -- taux négatif → amount_invalid (mêmes règles que le miroir TS fees.ts).
  begin
    perform private.compute_payment_fees(0, 180, 120);
    raise exception 'FAIL: fees montant 0 accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'amount_invalid' then raise exception 'FAIL fees 0 code: %', sqlerrm; end if;
  end;
  begin
    perform private.compute_payment_fees(-100, 180, 120);
    raise exception 'FAIL: fees montant négatif accepté';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform private.compute_payment_fees(null, 180, 120);
    raise exception 'FAIL: fees montant null accepté';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform private.compute_payment_fees(60000, -1, 120);
    raise exception 'FAIL: fees taux négatif accepté';
  exception when sqlstate 'P0001' then null;
  end;

  -- Insert direct avec frais faux → CHECK doit refuser.
  begin
    insert into public.payment_transactions (
      landlord_id, lease_id, provider, provider_reference,
      amount_received, psp_fee, platform_fee, net_amount, status
    ) values (
      v_landlord, v_lease, 'fedapay', 'PSP-BADFEES',
      60000, 999, 999, 58002, 'pending'
    );
    raise exception 'FAIL: frais incohérents acceptés';
  exception when check_violation then
    null; -- attendu
  end;

  -- CHECKs machine à états : 'verified' sans réception liée, 'paid_out' sans
  -- horodatage → refusés même par un INSERT direct (défense contre une RPC boguée).
  begin
    insert into public.payment_transactions (
      landlord_id, lease_id, provider, provider_reference,
      amount_received, psp_fee, platform_fee, net_amount,
      psp_fee_bp, platform_fee_bp, status
    ) values (
      v_landlord, v_lease, 'fedapay', 'PSP-BADSTATE-1',
      60000, 1080, 720, 58200, 180, 120, 'verified'
    );
    raise exception 'FAIL: verified sans rent_reception_id accepté';
  exception when check_violation then
    null; -- attendu
  end;
  begin
    insert into public.payment_transactions (
      landlord_id, lease_id, provider, provider_reference,
      amount_received, psp_fee, platform_fee, net_amount,
      psp_fee_bp, platform_fee_bp, status
    ) values (
      v_landlord, v_lease, 'fedapay', 'PSP-BADSTATE-2',
      60000, 1080, 720, 58200, 180, 120, 'paid_out'
    );
    raise exception 'FAIL: paid_out sans paid_out_at accepté';
  exception when check_violation then
    null; -- attendu
  end;

  -- =========================================================================
  -- 2. Ingestion nominale → pending (le webhook n'écrit jamais de réception)
  -- =========================================================================
  select * into v_ing from public.ingest_payment_notification(
    'fedapay', 'PSP-001', v_lease, 60000, '{"src":"test"}'::jsonb);
  if not v_ing.created then raise exception 'FAIL ingest: created=false'; end if;
  if v_ing.status <> 'pending' then raise exception 'FAIL ingest status: %', v_ing.status; end if;

  select * into v_tx from public.payment_transactions where id = v_ing.transaction_id;
  if v_tx.landlord_id <> v_landlord then raise exception 'FAIL landlord dérivé: %', v_tx.landlord_id; end if;
  if v_tx.psp_fee_bp <> 180 or v_tx.platform_fee_bp <> 120
     or v_tx.psp_fee <> 1080 or v_tx.platform_fee <> 720 or v_tx.net_amount <> 58200 then
    raise exception 'FAIL fees ingest: % % % % %',
      v_tx.psp_fee_bp, v_tx.platform_fee_bp, v_tx.psp_fee, v_tx.platform_fee, v_tx.net_amount;
  end if;

  -- Provider inconnu refusé.
  begin
    perform public.ingest_payment_notification('paypal', 'PSP-XX', v_lease, 60000, null);
    raise exception 'FAIL: provider inconnu accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'provider_invalid' then raise exception 'FAIL provider code: %', sqlerrm; end if;
  end;
  if v_tx.rent_reception_id is not null then raise exception 'FAIL ingest: réception créée'; end if;

  -- =========================================================================
  -- 3. Idempotence : replay = même ligne, created=false, une seule ligne
  -- =========================================================================
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-001', v_lease, 60000, '{"src":"replay"}'::jsonb);
  if v_ing2.created then raise exception 'FAIL replay: created=true'; end if;
  if v_ing2.transaction_id <> v_ing.transaction_id then raise exception 'FAIL replay: id différent'; end if;

  select count(*) into v_count from public.payment_transactions
  where provider_reference = 'PSP-001';
  if v_count <> 1 then raise exception 'FAIL replay: % lignes', v_count; end if;

  -- =========================================================================
  -- 4. Montant inattendu / bail inactif → rejected, jamais droppé
  -- =========================================================================
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-MISMATCH', v_lease, 55000, null);
  if v_ing2.status <> 'rejected' then raise exception 'FAIL mismatch status: %', v_ing2.status; end if;
  select * into v_tx from public.payment_transactions where id = v_ing2.transaction_id;
  if v_tx.rejection_reason <> 'amount_mismatch' then
    raise exception 'FAIL mismatch reason: %', v_tx.rejection_reason;
  end if;

  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-DRAFT', v_lease_draft, 45000, null);
  if v_ing2.status <> 'rejected' then raise exception 'FAIL draft status: %', v_ing2.status; end if;
  select rejection_reason into v_tx.rejection_reason
  from public.payment_transactions where id = v_ing2.transaction_id;
  if v_tx.rejection_reason <> 'lease_not_active' then
    raise exception 'FAIL draft reason: %', v_tx.rejection_reason;
  end if;

  -- Bail inconnu → P0002 lease_not_found.
  begin
    perform public.ingest_payment_notification(
      'fedapay', 'PSP-GHOST', gen_random_uuid(), 60000, null);
    raise exception 'FAIL: bail fantôme accepté';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'lease_not_found' then raise exception 'FAIL ghost code: %', sqlerrm; end if;
  end;

  -- Gardes d'entrée : référence vide, montant nul.
  begin
    perform public.ingest_payment_notification('fedapay', '   ', v_lease, 60000, null);
    raise exception 'FAIL: référence vide acceptée';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'invalid_body' then raise exception 'FAIL ref vide code: %', sqlerrm; end if;
  end;
  begin
    perform public.ingest_payment_notification('fedapay', 'PSP-ZERO', v_lease, 0, null);
    raise exception 'FAIL: montant nul accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'amount_invalid' then raise exception 'FAIL montant nul code: %', sqlerrm; end if;
  end;

  -- =========================================================================
  -- 5. Garde d'appartenance : un autre propriétaire ne peut PAS valider
  -- =========================================================================
  perform set_config('request.jwt.claim.sub',
                     'c1111111-1111-1111-1111-111111111111', true);
  begin
    perform public.verify_payment_transaction(v_ing.transaction_id);
    raise exception 'FAIL: verify cross-landlord accepté';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'transaction_not_found' then raise exception 'FAIL guard code: %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claim.sub',
                     'b1111111-1111-1111-1111-111111111111', true);

  -- =========================================================================
  -- 6. Validation PAR LE PROPRIÉTAIRE : pipeline complet, atomique
  -- =========================================================================
  v_reception := public.verify_payment_transaction(v_ing.transaction_id);
  if v_reception is null then raise exception 'FAIL verify: pas de réception'; end if;

  select * into v_rec from public.rent_receptions where id = v_reception;
  if v_rec.recorded_by <> 'psp' then raise exception 'FAIL recorded_by: %', v_rec.recorded_by; end if;
  if v_rec.amount_received <> 60000 then raise exception 'FAIL brut: %', v_rec.amount_received; end if;
  if v_rec.payment_reference <> 'PSP-001' then raise exception 'FAIL ref: %', v_rec.payment_reference; end if;
  if v_rec.status <> 'confirmed' then raise exception 'FAIL confirm: %', v_rec.status; end if;

  select status into v_tx.status from public.rent_dues where id = v_due;
  if v_tx.status <> 'paid' then raise exception 'FAIL due pas payée: %', v_tx.status; end if;

  select count(*) into v_count from public.receipts
  where rent_reception_id = v_reception and status = 'issued';
  if v_count <> 1 then raise exception 'FAIL quittance: % reçus', v_count; end if;

  select * into v_tx from public.payment_transactions where id = v_ing.transaction_id;
  if v_tx.status <> 'verified' or v_tx.rent_reception_id <> v_reception or v_tx.verified_at is null then
    raise exception 'FAIL flip ledger: % %', v_tx.status, v_tx.rent_reception_id;
  end if;

  -- =========================================================================
  -- 7. Machine à états : pending → verified → paid_out, aucun retour
  -- =========================================================================
  begin
    perform public.verify_payment_transaction(v_ing.transaction_id);
    raise exception 'FAIL: double verify accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'transaction_not_pending' then raise exception 'FAIL double verify code: %', sqlerrm; end if;
  end;

  begin
    perform public.reject_payment_transaction(v_ing.transaction_id, 'test');
    raise exception 'FAIL: reject sur verified accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'transaction_not_pending' then raise exception 'FAIL reject code: %', sqlerrm; end if;
  end;

  begin
    perform public.verify_payment_transaction(v_ing2.transaction_id); -- rejected (KKP-DRAFT)
    raise exception 'FAIL: verify sur rejected accepté';
  exception when sqlstate 'P0001' then
    null;
  end;

  -- paid_out interdit sur pending.
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-PENDING', v_lease, 60000, null);
  begin
    perform public.mark_payment_transaction_paid_out(v_ing2.transaction_id);
    raise exception 'FAIL: paid_out sur pending accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'payout_not_applicable' then raise exception 'FAIL payout pending code: %', sqlerrm; end if;
  end;

  -- verified → paid_out, puis plus rien.
  perform public.mark_payment_transaction_paid_out(v_ing.transaction_id);
  select status, paid_out_at is not null into v_tx.status, v_ok
  from public.payment_transactions where id = v_ing.transaction_id;
  if v_tx.status <> 'paid_out' or not v_ok then
    raise exception 'FAIL paid_out: %', v_tx.status;
  end if;
  begin
    perform public.mark_payment_transaction_paid_out(v_ing.transaction_id);
    raise exception 'FAIL: double paid_out accepté';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'payout_not_applicable' then raise exception 'FAIL payout code: %', sqlerrm; end if;
  end;

  -- =========================================================================
  -- 11. Re-vérification au moment du verify : le bail a bougé ENTRE
  --     l'ingestion et la validation → re-rejet (retour null), jamais de réception.
  -- =========================================================================
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-RECHECK-END', v_lease, 60000, null);
  if v_ing2.status <> 'pending' then raise exception 'FAIL recheck setup: %', v_ing2.status; end if;

  update public.leases set status = 'ended', end_date = '2026-07-31' where id = v_lease;
  v_reception := public.verify_payment_transaction(v_ing2.transaction_id);
  if v_reception is not null then raise exception 'FAIL recheck: réception créée sur bail terminé'; end if;
  select status, rejection_reason into v_tx.status, v_tx.rejection_reason
  from public.payment_transactions where id = v_ing2.transaction_id;
  if v_tx.status <> 'rejected' or v_tx.rejection_reason <> 'lease_not_active' then
    raise exception 'FAIL recheck ended: % %', v_tx.status, v_tx.rejection_reason;
  end if;
  update public.leases set status = 'active', end_date = null where id = v_lease;

  -- Loyer modifié entre ingestion et validation → amount_mismatch.
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-RECHECK-RENT', v_lease, 60000, null);
  update public.leases set monthly_rent_amount = 65000 where id = v_lease;
  v_reception := public.verify_payment_transaction(v_ing2.transaction_id);
  if v_reception is not null then raise exception 'FAIL recheck rent: réception créée'; end if;
  select rejection_reason into v_tx.rejection_reason
  from public.payment_transactions where id = v_ing2.transaction_id;
  if v_tx.rejection_reason <> 'amount_mismatch' then
    raise exception 'FAIL recheck rent reason: %', v_tx.rejection_reason;
  end if;
  update public.leases set monthly_rent_amount = 60000 where id = v_lease;

  -- =========================================================================
  -- 12. Crédit non affecté (ADR-014) : plus aucune échéance ouverte au montant
  --     exact → réception confirmée SANS allocation, quittance émise, aucune
  --     échéance modifiée.
  -- =========================================================================
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-CREDIT', v_lease, 60000, null);
  if v_ing2.status <> 'pending' then raise exception 'FAIL credit setup: %', v_ing2.status; end if;

  v_reception := public.verify_payment_transaction(v_ing2.transaction_id);
  if v_reception is null then raise exception 'FAIL credit: pas de réception'; end if;

  select * into v_rec from public.rent_receptions where id = v_reception;
  if v_rec.status <> 'confirmed' then raise exception 'FAIL credit confirm: %', v_rec.status; end if;

  select count(*) into v_count from public.rent_reception_allocations
  where rent_reception_id = v_reception;
  if v_count <> 0 then raise exception 'FAIL credit: % allocations (attendu 0)', v_count; end if;

  select count(*) into v_count from public.receipts
  where rent_reception_id = v_reception and status = 'issued';
  if v_count <> 1 then raise exception 'FAIL credit quittance: %', v_count; end if;

  select status into v_tx.status from public.rent_dues where id = v_due;
  if v_tx.status <> 'paid' then raise exception 'FAIL credit: échéance modifiée: %', v_tx.status; end if;

  -- =========================================================================
  -- 13. Rejet ops nominal : pending → rejected, raison vide coalescée.
  -- =========================================================================
  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-REJECT', v_lease, 60000, null);
  perform public.reject_payment_transaction(v_ing2.transaction_id, '  ');
  select status, rejection_reason into v_tx.status, v_tx.rejection_reason
  from public.payment_transactions where id = v_ing2.transaction_id;
  if v_tx.status <> 'rejected' or v_tx.rejection_reason <> 'rejected' then
    raise exception 'FAIL reject nominal: % %', v_tx.status, v_tx.rejection_reason;
  end if;

  -- =========================================================================
  -- 8. GRANTS — le garde-fou anti « policy sans grant »
  -- =========================================================================
  -- RPC système : jamais exécutables par un rôle client.
  for v_r in
    select r.role_name, f.sig
    from (values ('anon'), ('authenticated')) as r(role_name),
         (values ('public.ingest_payment_notification(text,text,uuid,integer,jsonb)'),
                 ('public.reject_payment_transaction(uuid,text)'),
                 ('public.mark_payment_transaction_paid_out(uuid)')) as f(sig)
  loop
    if has_function_privilege(v_r.role_name, v_r.sig, 'execute') then
      raise exception 'FAIL grants: % exécutable par %', v_r.sig, v_r.role_name;
    end if;
  end loop;

  -- verify : accordée à authenticated (validation propriétaire), PAS à anon.
  if not has_function_privilege('authenticated',
      'public.verify_payment_transaction(uuid)', 'execute') then
    raise exception 'FAIL grants: authenticated sans execute sur verify (policy sans grant !)';
  end if;
  if has_function_privilege('anon',
      'public.verify_payment_transaction(uuid)', 'execute') then
    raise exception 'FAIL grants: anon peut exécuter verify';
  end if;

  if not has_function_privilege('service_role',
      'public.ingest_payment_notification(text,text,uuid,integer,jsonb)', 'execute') then
    raise exception 'FAIL grants: service_role sans execute sur ingest';
  end if;

  select count(*) into v_count from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'payment_transactions'
    and grantee = 'authenticated' and privilege_type <> 'SELECT';
  if v_count <> 0 then raise exception 'FAIL grants: authenticated a plus que SELECT'; end if;

  select count(*) into v_count from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'payment_transactions'
    and grantee = 'authenticated' and privilege_type = 'SELECT';
  if v_count <> 1 then raise exception 'FAIL grants: authenticated sans SELECT (policy sans grant !)'; end if;

  select count(*) into v_count from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'payment_transactions'
    and grantee = 'anon';
  if v_count <> 0 then raise exception 'FAIL grants: anon a des droits'; end if;

  -- =========================================================================
  -- 9. Déduplication cross-rail : référence déjà prise par un collage SMS
  -- =========================================================================
  perform private.record_collection_core(
    v_landlord, 'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    60000, 'mobile_money', now(), 'Collage SMS test', '[]'::jsonb,
    'landlord', null, 'PSP-CROSS');

  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-CROSS', v_lease, 60000, null);
  if v_ing2.status <> 'pending' then raise exception 'FAIL cross ingest: %', v_ing2.status; end if;

  begin
    perform public.verify_payment_transaction(v_ing2.transaction_id);
    raise exception 'FAIL: dédup cross-rail non déclenchée';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DUPLICATE_PAYMENT' then raise exception 'FAIL cross code: %', sqlerrm; end if;
  end;

  select status into v_tx.status from public.payment_transactions where id = v_ing2.transaction_id;
  if v_tx.status <> 'pending' then
    raise exception 'FAIL cross: transaction % au lieu de pending', v_tx.status;
  end if;

  -- =========================================================================
  -- 10. Audit : création + flips tracés
  -- =========================================================================
  select count(*) into v_count from public.audit_logs
  where entity_type = 'payment_transactions' and entity_id = v_ing.transaction_id
    and action = 'created';
  if v_count <> 1 then raise exception 'FAIL audit created: %', v_count; end if;

  select count(*) into v_count from public.audit_logs
  where entity_type = 'payment_transactions' and entity_id = v_ing.transaction_id
    and action = 'updated';
  if v_count < 2 then -- verify + paid_out
    raise exception 'FAIL audit updated: %', v_count;
  end if;

  -- =========================================================================
  -- 14. Transaction inconnue : reject et mark_paid_out → P0002, rien d'écrit.
  -- =========================================================================
  begin
    perform public.reject_payment_transaction(gen_random_uuid(), 'test');
    raise exception 'FAIL: reject sur transaction fantôme accepté';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'transaction_not_found' then raise exception 'FAIL reject ghost code: %', sqlerrm; end if;
  end;
  begin
    perform public.mark_payment_transaction_paid_out(gen_random_uuid());
    raise exception 'FAIL: paid_out sur transaction fantôme accepté';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'transaction_not_found' then raise exception 'FAIL payout ghost code: %', sqlerrm; end if;
  end;

  -- =========================================================================
  -- 15. Échéance ouverte au reste dû ≠ montant reçu → crédit non affecté :
  --     l'allocation exige l'égalité EXACTE du reste dû (jamais de partiel).
  -- =========================================================================
  insert into public.rent_dues (id, landlord_id, lease_id, tenant_id, unit_id,
                                period_start, period_end, due_date, amount_due,
                                currency, status, confirmation_token)
  values ('b7777777-7777-7777-7777-777777777778',
          v_landlord, v_lease, 'b5555555-5555-5555-5555-555555555555',
          'b4444444-4444-4444-4444-444444444444',
          '2026-08-01', '2026-08-31', '2026-08-05', 60000, 'XOF', 'expected',
          gen_random_uuid());

  -- Paiement partiel confirmé de 20 000 → reste dû 40 000 ≠ 60 000 reçus.
  v_reception := private.record_collection_core(
    v_landlord, 'b5555555-5555-5555-5555-555555555555',
    'b4444444-4444-4444-4444-444444444444',
    20000, 'cash', now(), 'partiel', jsonb_build_array(jsonb_build_object(
      'rent_due_id', 'b7777777-7777-7777-7777-777777777778',
      'amount_allocated', 20000)),
    'landlord', null, null);
  perform private.confirm_collection_core(v_landlord, v_reception);

  select * into v_ing2 from public.ingest_payment_notification(
    'fedapay', 'PSP-PARTIAL-DUE', v_lease, 60000, null);
  v_reception := public.verify_payment_transaction(v_ing2.transaction_id);
  if v_reception is null then raise exception 'FAIL partial-due: pas de réception'; end if;

  select count(*) into v_count from public.rent_reception_allocations
  where rent_reception_id = v_reception;
  if v_count <> 0 then
    raise exception 'FAIL partial-due: % allocations (attendu 0, reste dû 40000 ≠ 60000)', v_count;
  end if;
  select status into v_tx.status from public.rent_dues
  where id = 'b7777777-7777-7777-7777-777777777778';
  if v_tx.status = 'paid' then
    raise exception 'FAIL partial-due: échéance passée paid par un crédit non affecté';
  end if;

  raise notice 'ALL OK';
end $$;

-- ---------------------------------------------------------------------------
-- 16. Isolation RLS en lecture directe : sous le rôle authenticated, chaque
--     propriétaire ne lit QUE ses lignes (contrôle positif + négatif — un
--     policy cassé qui cache tout ferait échouer le contrôle positif).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',
                  'b1111111-1111-1111-1111-111111111111', true);
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.payment_transactions;
  if v_count < 1 then
    raise exception 'FAIL RLS: le propriétaire ne voit pas ses propres lignes (%)', v_count;
  end if;
end $$;
select set_config('request.jwt.claim.sub',
                  'c1111111-1111-1111-1111-111111111111', true);
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.payment_transactions;
  if v_count <> 0 then
    raise exception 'FAIL RLS: un autre propriétaire lit % lignes du ledger', v_count;
  end if;
  raise notice 'RLS OK';
end $$;
reset role;

rollback;
