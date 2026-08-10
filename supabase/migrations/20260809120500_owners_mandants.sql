-- ============================================================
-- 20260809120500 — Le propriétaire mandant (brique 2)
-- ============================================================
-- Pivot B2B : le titulaire du compte n'est plus un bailleur particulier mais
-- une entreprise de gestion immobilière, qui administre les biens d'autrui
-- sous mandat. Les CGU couvrent déjà ce cas — l'article 5 exige de
-- « disposer du droit de gérer les biens et les baux renseignés », ce qui est
-- la définition d'un mandat.
--
-- Choix d'architecture : le mandant n'est PAS un utilisateur. Il ne se
-- connecte pas, ne crée pas de compte, ne reçoit qu'un relevé. On ajoute donc
-- une dimension de regroupement au-dessus des biens, sans toucher au modèle
-- de cloisonnement existant (landlord_id = compte = agence). Les 35 policies
-- RLS, le helper private.current_landlord_id() et les ~130 gardes applicatives
-- restent inchangés : c'est ce qui rend ce pivot faisable sans réécriture.
--
-- Conséquence : un compte reste un portefeuille. Le partage entre plusieurs
-- employés d'une même agence est un chantier distinct, volontairement remis
-- à plus tard.
-- ============================================================

begin;

create table if not exists public.owners (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references public.landlords(id) on delete cascade,

  -- Personne physique ou société : un seul champ, saisi tel que l'agence
  -- l'écrit sur ses relevés. Découper en civilité/nom/prénom coûterait un
  -- écran de plus à l'import pour aucun usage produit.
  display_name  text not null check (btrim(display_name) <> ''),
  phone         text,
  email         text,

  -- Honoraires de gestion en points de base du loyer réellement encaissé.
  -- 800 = 8 %. Convention identique au reste du dépôt : entiers, jamais de
  -- flottant sur de l'argent.
  fee_rate_bp   integer not null default 0 check (fee_rate_bp between 0 and 10000),

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Un même nom de mandant ne peut pas exister deux fois dans un portefeuille :
-- c'est la clé de rapprochement de l'import de fichier (brique 1).
create unique index if not exists owners_landlord_name_unique
  on public.owners (landlord_id, lower(btrim(display_name)))
  where deleted_at is null;

create index if not exists owners_landlord_idx
  on public.owners (landlord_id) where deleted_at is null;

-- Rattachement du bien à son mandant. Nullable : un bien détenu en propre par
-- le titulaire du compte n'a pas de mandant, et les portefeuilles existants
-- restent valides sans migration de données.
alter table public.properties
  add column if not exists owner_id uuid references public.owners(id);

create index if not exists properties_owner_idx
  on public.properties (owner_id) where deleted_at is null;

comment on column public.properties.owner_id is
  'Mandant pour le compte duquel le bien est géré. NULL = bien détenu en propre.';

-- ── RLS : même patron que toutes les autres tables métier ──────────────────
alter table public.owners enable row level security;

drop policy if exists owners_select_own on public.owners;
create policy owners_select_own on public.owners
  for select to authenticated
  using (landlord_id = private.current_landlord_id());

drop policy if exists owners_insert_own on public.owners;
create policy owners_insert_own on public.owners
  for insert to authenticated
  with check (landlord_id = private.current_landlord_id());

drop policy if exists owners_update_own on public.owners;
create policy owners_update_own on public.owners
  for update to authenticated
  using (landlord_id = private.current_landlord_id())
  with check (landlord_id = private.current_landlord_id());

grant select, insert, update on table public.owners to authenticated;

-- ── Triggers conventionnels ────────────────────────────────────────────────
drop trigger if exists owners_set_updated_at on public.owners;
create trigger owners_set_updated_at
  before update on public.owners
  for each row execute function public.set_updated_at();

drop trigger if exists owners_audit on public.owners;
create trigger owners_audit
  after insert or update on public.owners
  for each row execute function private.log_audit();

drop trigger if exists trg_audit_owners_archive on public.owners;
create trigger trg_audit_owners_archive
  after update on public.owners
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.audit_soft_archive();

comment on table public.owners is
  'Propriétaires mandants d''une entreprise de gestion. Ne sont pas des
   utilisateurs : aucun compte, aucun accès. Reçoivent un relevé mensuel.';

commit;
