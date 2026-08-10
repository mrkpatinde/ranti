-- ============================================================
-- Portefeuille de démonstration — entretiens terrain
-- ============================================================
-- Charge un portefeuille réaliste dans le compte désigné par :dem_email
-- (l'utilisateur doit s'être connecté une fois via Google et avoir complété
-- son profil). Le script passe par les MÊMES RPC que le produit — import,
-- encaissement, confirmation, quittance — sous l'identité du compte : la RLS
-- s'applique, les triggers tournent, le grand livre est alimenté.
--
-- Scénario : Horizon Gestion, 2 mandants, 3 immeubles, 10 lots dont 8 loués
-- et 2 vacants. Juillet entièrement encaissé (le relevé de clôture est
-- complet). Août en cours : 4 loyers payés, 1 partiel, 3 en retard — la file
-- de relance a du contenu, la clôture d'août montre un mois vivant.
--
-- Usage :  psql ... -v dem_email='demo@exemple.com' -f seed-demo.sql
-- Rejouable : s'arrête si le compte porte déjà des lots (pas de doublon).
-- ============================================================

\set ON_ERROR_STOP on

begin;

select set_config('vars.dem_email', :'dem_email', true);

do $$
declare
  v_uid uuid;
  v_landlord uuid;
  v_import jsonb;
  v_rec uuid;
  r record;
  v_july date := date_trunc('month', current_date)::date - interval '1 month';
begin
  select u.id into v_uid from auth.users u where u.email = current_setting('vars.dem_email', true);
  if v_uid is null then
    raise exception 'Aucun utilisateur auth avec cet e-mail. Connexion Google d''abord.';
  end if;

  select l.id into v_landlord from public.landlords l where l.auth_user_id = v_uid and l.deleted_at is null;
  if v_landlord is null then
    raise exception 'Profil non complété : ouvrir l''app et renseigner le profil d''abord.';
  end if;

  if exists (select 1 from public.units u where u.landlord_id = v_landlord and u.deleted_at is null) then
    raise exception 'Ce compte porte déjà des lots — seed refusé pour ne pas polluer.';
  end if;

  -- Identité d'exécution : le compte lui-même. RLS et triggers s'appliquent.
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  update public.landlords set company_name = coalesce(company_name, 'Horizon Gestion')
  where id = v_landlord;

  -- ── Import du portefeuille : la RPC du produit ────────────────────────────
  select public.import_portfolio(jsonb_build_array(
    -- Mandant 1 : M. Codjo Agbodjan, 8 % — Résidence Les Cocotiers (Fidjrossè)
    jsonb_build_object('owner_name','Codjo Agbodjan','owner_phone','+22997110011','owner_fee_rate_bp','800',
      'property_name','Résidence Les Cocotiers','property_city','Cotonou','property_address','Fidjrossè, rue 210',
      'unit_name','Appartement A1','unit_type','apartment','tenant_first_name','Grâce','tenant_last_name','Houngbédji',
      'tenant_phone','+22996120001','monthly_rent_amount','120000','due_day','5','start_date', to_char(current_date - interval '3 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Codjo Agbodjan','property_name','Résidence Les Cocotiers',
      'unit_name','Appartement A2','unit_type','apartment','tenant_first_name','Rodrigue','tenant_last_name','Assogba',
      'tenant_phone','+22996120002','monthly_rent_amount','110000','due_day','5','start_date', to_char(current_date - interval '3 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Codjo Agbodjan','property_name','Résidence Les Cocotiers',
      'unit_name','Studio B','unit_type','room','tenant_first_name','Espérance','tenant_last_name','Dossou',
      'tenant_phone','+22996120003','monthly_rent_amount','55000','due_day','5','start_date', to_char(current_date - interval '2 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Codjo Agbodjan','property_name','Résidence Les Cocotiers',
      'unit_name','Studio C','unit_type','room'),
    -- Mandant 2 : Succession Quenum, 10 % — Immeuble Quenum (Ganhi) + Villa Calavi
    jsonb_build_object('owner_name','Succession Quenum','owner_phone','+22997220022','owner_fee_rate_bp','1000',
      'property_name','Immeuble Quenum','property_city','Cotonou','property_address','Ganhi, av. Clozel',
      'unit_name','Boutique RDC','unit_type','shop','tenant_first_name','Mariam','tenant_last_name','Soulé',
      'tenant_phone','+22996120004','monthly_rent_amount','180000','due_day','1','start_date', to_char(current_date - interval '3 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Succession Quenum','property_name','Immeuble Quenum',
      'unit_name','Bureau 1er','unit_type','office','tenant_first_name','Cabinet','tenant_last_name','Adjovi & Co',
      'tenant_phone','+22996120005','monthly_rent_amount','150000','due_day','1','start_date', to_char(current_date - interval '3 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Succession Quenum','property_name','Immeuble Quenum',
      'unit_name','Appartement 2e','unit_type','apartment','tenant_first_name','Bernadin','tenant_last_name','Gbaguidi',
      'tenant_phone','+22996120006','monthly_rent_amount','95000','due_day','1','start_date', to_char(current_date - interval '2 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Succession Quenum','property_name','Immeuble Quenum',
      'unit_name','Appartement 3e','unit_type','apartment'),
    jsonb_build_object('owner_name','Succession Quenum','property_name','Villa Calavi','property_city','Abomey-Calavi',
      'unit_name','Villa entière','unit_type','house','tenant_first_name','Sènami','tenant_last_name','Ahouansou',
      'tenant_phone','+22996120007','monthly_rent_amount','140000','due_day','10','start_date', to_char(current_date - interval '2 months','YYYY-MM-01')),
    jsonb_build_object('owner_name','Codjo Agbodjan','property_name','Résidence Les Cocotiers',
      'unit_name','Appartement A3','unit_type','apartment','tenant_first_name','Firmin','tenant_last_name','Zannou',
      'tenant_phone','+22996120008','monthly_rent_amount','85000','due_day','15','start_date', to_char(current_date - interval '2 months','YYYY-MM-01'))
  ), gen_random_uuid()) into v_import;
  raise notice 'Import : %', v_import;

  -- ── Juillet : tout encaissé, confirmé, quittancé ──────────────────────────
  for r in
    select d.id, d.tenant_id, d.unit_id, d.amount_due, d.due_date
    from public.rent_dues d
    where d.landlord_id = v_landlord and d.deleted_at is null
      and d.period_start < date_trunc('month', current_date)
  loop
    select public.record_collection(
      r.tenant_id, r.unit_id, r.amount_due, 'mobile_money',
      (r.due_date - 1)::timestamptz, null,
      jsonb_build_array(jsonb_build_object('rent_due_id', r.id, 'amount_allocated', r.amount_due)),
      null, gen_random_uuid()
    ) into v_rec;
    perform public.confirm_collection(v_rec);
    perform public.generate_receipt(v_rec);
  end loop;

  -- ── Août : 4 payés, 1 partiel, le reste en retard ─────────────────────────
  for r in
    select d.id, d.tenant_id, d.unit_id, d.amount_due, d.due_date,
           row_number() over (order by d.amount_due desc) as rn
    from public.rent_dues d
    where d.landlord_id = v_landlord and d.deleted_at is null
      and d.period_start >= date_trunc('month', current_date)
  loop
    if r.rn <= 4 then
      select public.record_collection(r.tenant_id, r.unit_id, r.amount_due, 'mobile_money',
        greatest(r.due_date, current_date - 3)::timestamptz, null,
        jsonb_build_array(jsonb_build_object('rent_due_id', r.id, 'amount_allocated', r.amount_due)),
        null, gen_random_uuid()) into v_rec;
      perform public.confirm_collection(v_rec);
      perform public.generate_receipt(v_rec);
    elsif r.rn = 5 then
      select public.record_collection(r.tenant_id, r.unit_id, (r.amount_due/2)::int, 'cash',
        (current_date - 2)::timestamptz, null,
        jsonb_build_array(jsonb_build_object('rent_due_id', r.id, 'amount_allocated', (r.amount_due/2)::int)),
        null, gen_random_uuid()) into v_rec;
      perform public.confirm_collection(v_rec);
    end if;
    -- rn > 5 : rien — impayés, la file de relance les ramasse.
  end loop;

  raise notice 'Seed terminé pour landlord %', v_landlord;
end $$;

commit;
