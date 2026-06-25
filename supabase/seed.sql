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
