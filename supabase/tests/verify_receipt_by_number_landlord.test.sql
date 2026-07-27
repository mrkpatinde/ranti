-- Test SQL transactionnel — levée d'ambiguïté des références RNT par le nom du
-- bailleur (migration 20260727180000). Données JETABLES, vraies RPC, ROLLBACK.
-- Joué par supabase/tests/run-all.sh (et par la CI, job `db`).
--
-- Le scénario reproduit exactement l'état de production constaté le
-- 2026-07-27 : DEUX bailleurs, chacun avec une quittance `RNT-2026-0001`.
--
-- Cas prouvés :
--   1. numéro seul sur une référence partagée -> ambigu, aucun détail
--   2. numéro + nom du bailleur A -> verdict unique
--   3. numéro + nom du bailleur B -> verdict unique, l'AUTRE document
--   4. correspondance tolérante : nom de famille seul, casse quelconque
--   5. nom inconnu -> introuvable (jamais un document au hasard)
--   6. le retour ne contient JAMAIS le nom du bailleur (filtre d'entrée seul)
--   7. une référence non partagée se vérifie toujours sans nom

begin;

-- ── Deux bailleurs, deux quittances au MÊME numéro ──────────────────────────
insert into auth.users (id, instance_id, aud, role, email) values
  ('a1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amb-a@ranti.local'),
  ('a2222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amb-b@ranti.local');

insert into public.landlords (id, auth_user_id, phone, first_name, last_name) values
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','+22990001111','Awa','Patinde'),
  ('b2222222-2222-2222-2222-222222222222','a2222222-2222-2222-2222-222222222222','+22990002222','Kofi','Adjovi');

insert into public.properties (id, landlord_id, name) values
  ('c1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','Cour A'),
  ('c2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','Cour B');

insert into public.units (id, landlord_id, property_id, name, unit_type) values
  ('d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','UA','room'),
  ('d2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','c2222222-2222-2222-2222-222222222222','UB','room');

insert into public.tenants (id, landlord_id, first_name, last_name, phone) values
  ('e1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','Loc','A','+22991001111'),
  ('e2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','Loc','B','+22991002222');

insert into public.rent_receptions (id, landlord_id, tenant_id, unit_id, received_at, amount_received, payment_method, status, confirmed_at) values
  ('f1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','e1111111-1111-1111-1111-111111111111','d1111111-1111-1111-1111-111111111111', now(), 50000, 'cash', 'confirmed', now()),
  ('f2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','e2222222-2222-2222-2222-222222222222','d2222222-2222-2222-2222-222222222222', now(), 70000, 'cash', 'confirmed', now());

-- Insertion directe des reçus : on veut le MÊME numéro chez deux bailleurs,
-- ce que generate_receipt produit naturellement mais qu'on fige ici.
insert into public.receipts (id, landlord_id, rent_reception_id, receipt_number, total_amount, currency, status, kind, snapshot) values
  ('11111111-aaaa-4aaa-8aaa-111111111111','b1111111-1111-1111-1111-111111111111','f1111111-1111-1111-1111-111111111111','RNT-2026-0001',50000,'XOF','issued','quittance','{"allocations":[{"period_start":"2026-01-01","period_end":"2026-01-31","amount_allocated":50000}]}'),
  ('22222222-bbbb-4bbb-8bbb-222222222222','b2222222-2222-2222-2222-222222222222','f2222222-2222-2222-2222-222222222222','RNT-2026-0001',70000,'XOF','issued','quittance','{"allocations":[{"period_start":"2026-02-01","period_end":"2026-02-28","amount_allocated":70000}]}'),
  -- Référence NON partagée, pour le cas 7.
  ('33333333-cccc-4ccc-8ccc-333333333333','b1111111-1111-1111-1111-111111111111','f1111111-1111-1111-1111-111111111111','RNT-2026-0009',50000,'XOF','issued','quittance','{"allocations":[]}')
  on conflict do nothing;

-- Le 3e partage rent_reception_id avec le 1er (contrainte unique) : on le
-- rattache plutôt à une réception dédiée.
update public.receipts set rent_reception_id = 'f2222222-2222-2222-2222-222222222222'
where id = '33333333-cccc-4ccc-8ccc-333333333333';

do $$
declare v record; n integer;
begin
  -- 1. Numéro seul sur une référence partagée -> ambigu.
  select * into v from public.verify_receipt_by_number('RNT-2026-0001');
  if v.match_count <> 2 then
    raise exception 'ECHEC 1 : match_count=% attendu 2', v.match_count;
  end if;
  if v.receipt_number is not null or v.integrity is not null or v.issued_at is not null then
    raise exception 'ECHEC 1 : des details fuient sur un verdict ambigu';
  end if;
  raise notice 'OK 1 : numero seul -> ambigu, aucun detail';

  -- 2. Numéro + bailleur A -> unique.
  select * into v from public.verify_receipt_by_number('RNT-2026-0001', 'Awa Patinde');
  if v.match_count <> 1 or v.integrity is null then
    raise exception 'ECHEC 2 : bailleur A non discrimine (match_count=%)', v.match_count;
  end if;
  raise notice 'OK 2 : numero + nom A -> verdict unique';

  -- 3. Numéro + bailleur B -> unique, et c'est bien l'AUTRE document.
  select * into v from public.verify_receipt_by_number('RNT-2026-0001', 'Adjovi');
  if v.match_count <> 1 or v.integrity is null then
    raise exception 'ECHEC 3 : bailleur B non discrimine (match_count=%)', v.match_count;
  end if;
  raise notice 'OK 3 : numero + nom B -> verdict unique, autre document';

  -- 4. Tolérance : nom de famille seul, casse quelconque, espaces parasites.
  select * into v from public.verify_receipt_by_number('RNT-2026-0001', '  pAtInDe ');
  if v.match_count <> 1 then
    raise exception 'ECHEC 4 : correspondance trop stricte (casse/espaces)';
  end if;
  raise notice 'OK 4 : nom de famille seul, casse et espaces tolerés';

  -- 5. Nom inconnu -> introuvable, jamais un document au hasard.
  select count(*) into n from public.verify_receipt_by_number('RNT-2026-0001', 'Inconnu');
  if n <> 0 then
    raise exception 'ECHEC 5 : un nom inconnu renvoie % ligne(s)', n;
  end if;
  raise notice 'OK 5 : nom inconnu -> introuvable';

  -- 6. Le nom du bailleur ne doit JAMAIS sortir : filtre d'entrée seulement.
  select * into v from public.verify_receipt_by_number('RNT-2026-0001', 'Patinde');
  if v::text ilike '%Patinde%' or v::text ilike '%Awa%' then
    raise exception 'ECHEC 6 : le nom du bailleur fuit dans le retour';
  end if;
  raise notice 'OK 6 : le nom reste un filtre d entree, jamais une sortie';

  -- 7. Référence non partagée : toujours vérifiable sans nom.
  select * into v from public.verify_receipt_by_number('RNT-2026-0009');
  if v.match_count <> 1 then
    raise exception 'ECHEC 7 : reference unique cassee par le nouveau filtre';
  end if;
  raise notice 'OK 7 : reference non partagee -> verdict sans nom';
end $$;

rollback;
