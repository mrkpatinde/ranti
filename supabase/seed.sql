-- Ranti development seed
-- Minimal loop: landlord -> property -> unit -> tenant -> lease -> due -> rent reception -> allocation -> receipt

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'adonis.ranti@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

-- Utilisateur d'AUTH LOCALE (RANTI_LOCAL_AUTH, lib/auth/server.ts).
-- L'app fabrique des claims pour ce sub en dev/test, mais la ligne auth.users
-- manquait : toute creation de profil echouait sur la cle etrangere
-- landlords.auth_user_id -> auth.users(id) (« Creation du profil impossible »),
-- ce qui rendait impossible tout E2E authentifie porteur de donnees.
-- Volontairement SANS profil bailleur : deux specs verifient la redirection
-- « utilisateur authentifie sans profil -> onboarding ». Les tests qui ont
-- besoin d'un profil le creent par le vrai parcours.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'local-auth@ranti.local',
  crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
)
on conflict (id) do nothing;

insert into public.landlords (
  id,
  auth_user_id,
  phone,
  first_name,
  last_name,
  civility
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '+2290100000000',
  'Adonis',
  'Kpatinde',
  'mr'
)
on conflict (id) do nothing;

insert into public.properties (id, landlord_id, name, city, address)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Maison Agla',
  'Cotonou',
  'Agla'
)
on conflict (id) do nothing;

insert into public.units (id, landlord_id, property_id, name, unit_type, availability_status)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Appartement A1',
  'apartment',
  'occupied'
)
on conflict (id) do nothing;

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Koffi',
  'Mensah',
  '+2290199999999'
)
on conflict (id) do nothing;

insert into public.leases (
  id,
  landlord_id,
  unit_id,
  tenant_id,
  monthly_rent_amount,
  currency,
  due_day,
  start_date,
  status
)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  50000,
  'XOF',
  5,
  '2026-07-01',
  'active'
)
on conflict (id) do nothing;

insert into public.rent_dues (
  id,
  landlord_id,
  lease_id,
  unit_id,
  tenant_id,
  period_start,
  period_end,
  due_date,
  amount_due,
  currency,
  status
)
values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '2026-07-01',
  '2026-07-31',
  '2026-07-05',
  50000,
  'XOF',
  'paid'
)
on conflict (id) do nothing;

insert into public.rent_receptions (
  id,
  landlord_id,
  tenant_id,
  unit_id,
  received_at,
  amount_received,
  currency,
  payment_method,
  status,
  confirmed_at,
  note
)
values (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '2026-07-05 10:00:00+00',
  50000,
  'XOF',
  'cash',
  'confirmed',
  '2026-07-05 10:02:00+00',
  'Loyer reçu en espèces.'
)
on conflict (id) do nothing;

insert into public.rent_reception_allocations (
  id,
  landlord_id,
  rent_reception_id,
  rent_due_id,
  amount_allocated
)
values (
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  50000
)
on conflict (id) do nothing;

insert into public.receipts (
  id,
  landlord_id,
  rent_reception_id,
  receipt_number,
  issued_at,
  total_amount,
  currency,
  status
)
values (
  '90000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'RANTI-2026-0001',
  '2026-07-05 10:03:00+00',
  50000,
  'XOF',
  'issued'
)
on conflict (id) do nothing;

insert into public.audit_logs (
  landlord_id,
  actor_landlord_id,
  action,
  entity_type,
  entity_id,
  metadata
)
values (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'rent_reception.confirmed',
  'rent_reception',
  '70000000-0000-0000-0000-000000000001',
  '{"source":"seed"}'::jsonb
);

-- ============================================================
-- Bailleurs de TEST ISOLÉS (E2E Playwright, 2026-07-27)
--
-- Chaque spec vise son propre bailleur via l'en-tête x-ranti-local-auth-user
-- (lib/auth/local-identity). Avant ça, toutes partageaient le même utilisateur
-- d'auth locale : une spec qui créait un profil cassait celles qui exigent un
-- utilisateur sans profil. L'isolation est ici, dans les DONNÉES ; le routage
-- est dans l'en-tête.
--
-- État de chacun, choisi pour être exactement ce que sa spec doit exercer :
--   ...0001  authentifié, AUCUN profil  -> gardes « sans profil »
--   ...0002  profil, onboarding `guided`, AUCUN bail -> entrée du parcours guidé
--   ...0003  profil, onboarding `guided`, UN bail marqué onboarding
--            -> régression v0.3.38.0 : recharger /first-run ne doit pas
--               reproposer de créer un bail qui existe
-- ============================================================

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000002','authenticated','authenticated','e2e-guided@ranti.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000003','authenticated','authenticated','e2e-resume@ranti.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.landlords (id, auth_user_id, phone, first_name, last_name, civility, onboarding_status)
values
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','+2290100000002','Guidee','Test','mrs','guided'),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','+2290100000003','Reprise','Test','mrs','guided')
on conflict (id) do nothing;

-- Bailleur ...0003 : un bail DÉJÀ créé pendant la prise en main. C'est le seul
-- état où le doublon pouvait se produire.
insert into public.properties (id, landlord_id, name, city)
values ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Cour Reprise','Calavi')
on conflict (id) do nothing;

insert into public.units (id, landlord_id, property_id, name, unit_type)
values ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','Chambre Reprise','room')
on conflict (id) do nothing;

insert into public.tenants (id, landlord_id, first_name, last_name, phone)
values ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Locataire','Reprise','+2299100000003')
on conflict (id) do nothing;

insert into public.leases (
  id, landlord_id, unit_id, tenant_id, monthly_rent_amount, due_day, start_date,
  status, created_during_onboarding
)
values ('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',
        '30000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003',
        75000, 5, date '2026-07-01', 'active', true)
on conflict (id) do nothing;

insert into public.rent_dues (
  id, landlord_id, lease_id, unit_id, tenant_id, period_start, period_end,
  due_date, amount_due, currency, status
)
values ('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',
        '50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',
        '40000000-0000-4000-8000-000000000003', date '2026-07-01', date '2026-07-31',
        date '2026-07-05', 75000, 'XOF', 'expected')
on conflict (id) do nothing;
