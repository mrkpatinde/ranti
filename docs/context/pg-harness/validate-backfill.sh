#!/bin/bash
# Valide le BACKFILL d'ADR-023 sur une base PEUPLÉE : migrations jusqu'à la
mkdir -p /tmp/pg-harness-logs
# veille du ledger, données legacy dans tous les états, puis migration ledger.
set -e
BASE=/var/lib/postgresql/ranti-harness
export PGHOST=$BASE/sock PGPORT=55432 PGUSER=postgres
REPO=/home/user/ranti
LEDGER=20260716150000_ledger_transactions_expand.sql
CHARGES=20260716210000_ledger_charges_tenant_flow.sql
GATES=20260716230000_ledger_gates_reminders.sql

psql -d postgres -q -c "drop database if exists backfill_test"
psql -d postgres -q -c "create database backfill_test"
psql -d backfill_test -v ON_ERROR_STOP=1 -q <<'EOF'
create schema auth;
create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text, created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
EOF

for f in $(ls "$REPO/supabase/migrations" | sort); do
  if [ "$f" = "$LEDGER" ] || [ "$f" = "$CHARGES" ] || [ "$f" = "$GATES" ]; then continue; fi
  psql -d backfill_test -v ON_ERROR_STOP=1 -q -f "$REPO/supabase/migrations/$f" >/dev/null
done

# Population legacy — via les vraies RPC
psql -d backfill_test -v ON_ERROR_STOP=1 -q <<'EOF'
insert into auth.users (id, instance_id, aud, role, email)
values ('f1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','backfill@ranti.local');
insert into public.landlords (id, auth_user_id, phone, first_name, last_name)
values ('f2222222-2222-2222-2222-222222222222','f1111111-1111-1111-1111-111111111111','+22990000077','Back','Fill');
select set_config('request.jwt.claim.sub','f1111111-1111-1111-1111-111111111111', false);
insert into public.properties (id, landlord_id, name)
values ('f3333333-3333-3333-3333-333333333333','f2222222-2222-2222-2222-222222222222','Cour Backfill');
insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values ('f4444444-4444-4444-4444-444444444444','f2222222-2222-2222-2222-222222222222','f3333333-3333-3333-3333-333333333333','Ch B','room','occupied');
insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('f5555555-5555-5555-5555-555555555555','f2222222-2222-2222-2222-222222222222','Ba','Fill','+2290100000077');
insert into public.leases (id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date, status)
values ('f6666666-6666-6666-6666-666666666666','f2222222-2222-2222-2222-222222222222','f4444444-4444-4444-4444-444444444444','f5555555-5555-5555-5555-555555555555',40000,5,(date_trunc('month', current_date) - interval '3 month')::date,'active');

do $$
declare
  d1 uuid; d2 uuid; d3 uuid; d4 uuid;
  r_conf uuid; r_draft uuid; r_cancelconf uuid; r_canceldraft uuid; r_psp uuid;
begin
  perform public.generate_rent_dues('f6666666-6666-6666-6666-666666666666');
  select id into d1 from public.rent_dues where lease_id='f6666666-6666-6666-6666-666666666666' order by due_date asc limit 1;
  select id into d2 from public.rent_dues where lease_id='f6666666-6666-6666-6666-666666666666' order by due_date asc limit 1 offset 1;
  select id into d3 from public.rent_dues where lease_id='f6666666-6666-6666-6666-666666666666' order by due_date asc limit 1 offset 2;
  select id into d4 from public.rent_dues where lease_id='f6666666-6666-6666-6666-666666666666' order by due_date desc limit 1;

  -- Réception confirmée (solde le mois 1)
  r_conf := public.record_collection('f5555555-5555-5555-5555-555555555555','f4444444-4444-4444-4444-444444444444',
    40000,'cash',null,'mois 1', jsonb_build_array(jsonb_build_object('rent_due_id',d1,'amount_allocated',40000)), null, gen_random_uuid());
  perform public.confirm_collection(r_conf);

  -- Brouillon en cours (acompte mois 2)
  r_draft := public.record_collection('f5555555-5555-5555-5555-555555555555','f4444444-4444-4444-4444-444444444444',
    5000,'mobile_money',null,'acompte', jsonb_build_array(jsonb_build_object('rent_due_id',d2,'amount_allocated',5000)), null, gen_random_uuid());

  -- Confirmée puis annulée (motif)
  r_cancelconf := public.record_collection('f5555555-5555-5555-5555-555555555555','f4444444-4444-4444-4444-444444444444',
    10000,'cash',null,'erreur', jsonb_build_array(jsonb_build_object('rent_due_id',d2,'amount_allocated',10000)), null, gen_random_uuid());
  perform public.confirm_collection(r_cancelconf);
  perform public.cancel_collection(r_cancelconf, 'double saisie');

  -- Brouillon annulé
  r_canceldraft := public.record_collection('f5555555-5555-5555-5555-555555555555','f4444444-4444-4444-4444-444444444444',
    7000,'cash',null,'abandon', jsonb_build_array(jsonb_build_object('rent_due_id',d3,'amount_allocated',7000)), null, gen_random_uuid());
  perform public.cancel_collection(r_canceldraft, 'abandonné');

  -- Rail PSP : réception recorded_by=psp confirmée (chemin core, comme verify_payment_transaction)
  r_psp := private.record_collection_core('f2222222-2222-2222-2222-222222222222','f5555555-5555-5555-5555-555555555555','f4444444-4444-4444-4444-444444444444',
    40000,'mobile_money',now(),'Paiement feexpay validé', jsonb_build_array(jsonb_build_object('rent_due_id',d3,'amount_allocated',33000)),'psp','feexpay','FEEX-123');
  perform private.confirm_collection_core('f2222222-2222-2222-2222-222222222222', r_psp);

  -- Échéance annulée (la plus récente, non allouée)
  perform public.cancel_rent_due(d4, 'logement libéré');
end $$;
EOF

echo "-- Application de la migration ledger sur base peuplée --"
psql -d backfill_test -v ON_ERROR_STOP=1 -q -f "$REPO/supabase/migrations/$LEDGER"
psql -d backfill_test -v ON_ERROR_STOP=1 -q -f "$REPO/supabase/migrations/$CHARGES"
psql -d backfill_test -v ON_ERROR_STOP=1 -q -f "$REPO/supabase/migrations/$GATES"

# Assertions post-backfill
psql -d backfill_test -v ON_ERROR_STOP=1 -q <<'EOF'
do $$
declare
  n int; n_dues int;
begin
  -- Garde d'égalité (re-check explicite)
  select count(*) into n from private.verify_ledger_equality();
  if n <> 0 then raise exception 'ASSERT: % écart(s) d''égalité', n; end if;

  -- Un débit loyer par échéance
  select count(*) into n_dues from public.rent_dues;
  select count(*) into n from public.transactions where type='loyer' and legacy_ref like 'due:%' and legacy_ref not like '%:%:%';
  if n <> n_dues then raise exception 'ASSERT: % débits loyer pour % échéances', n, n_dues; end if;

  -- Échéance annulée : paire débit + contre-passation, motif repris
  select count(*) into n from public.transactions
  where type='contre_passation' and legacy_ref like 'due:%:cancel' and label like '%logement libéré%' and status='validated';
  if n <> 1 then raise exception 'ASSERT: contre-passation d''échéance annulée: %', n; end if;

  -- Confirmée → validated(landlord, manuel)
  select count(*) into n from public.transactions
  where type='reglement' and status='validated' and validated_by='landlord' and source='manuel' and amount=40000;
  if n <> 1 then raise exception 'ASSERT: crédit confirmé manuel: %', n; end if;

  -- Brouillon → pending
  select count(*) into n from public.transactions where type='reglement' and status='pending' and amount=5000;
  if n <> 1 then raise exception 'ASSERT: crédit brouillon pending: %', n; end if;

  -- Confirmée-puis-annulée → paire crédit validated + contre-passation motif
  select count(*) into n from public.transactions
  where type='contre_passation' and legacy_ref like 'alloc:%:cancel' and label like '%double saisie%' and status='validated';
  if n <> 1 then raise exception 'ASSERT: contre-passation encaissement: %', n; end if;

  -- Brouillon annulé → withdrawn(retrait_auteur), pas de contre-passation
  select count(*) into n from public.transactions
  where type='reglement' and status='withdrawn' and resolution='retrait_auteur' and amount=7000;
  if n <> 1 then raise exception 'ASSERT: brouillon annulé withdrawn: %', n; end if;

  -- PSP → validated(system, feexpay)
  select count(*) into n from public.transactions
  where type='reglement' and status='validated' and validated_by='system' and source='feexpay' and amount=33000;
  if n <> 1 then raise exception 'ASSERT: crédit feexpay system: %', n; end if;

  raise notice 'BACKFILL OK — toutes les assertions passent';
end $$;

-- Idempotence : rejouer les insert du backfill ne crée rien (via on conflict).
-- On rejoue le 2a (représentatif) :
do $$
declare before_n int; after_n int;
begin
  select count(*) into before_n from public.transactions;
  insert into public.transactions (
    landlord_id, lease_id, type, direction, amount, currency, occurred_at,
    due_date, period_start, period_end, status, validated_by, validated_at,
    source, label, legacy_ref
  )
  select
    d.landlord_id, d.lease_id, 'loyer', 'debit', d.amount_due, d.currency,
    d.created_at, d.due_date, d.period_start, d.period_end,
    'validated', 'system', d.created_at, 'genere_par_bail',
    'Loyer ' || to_char(d.period_start, 'YYYY-MM'), 'due:' || d.id
  from public.rent_dues d
  on conflict (legacy_ref) where legacy_ref is not null do nothing;
  select count(*) into after_n from public.transactions;
  if before_n <> after_n then raise exception 'ASSERT: rejeu backfill a créé % lignes', after_n - before_n; end if;
  raise notice 'IDEMPOTENCE OK';
end $$;
EOF
echo "VALIDATE-BACKFILL DONE"
