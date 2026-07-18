-- Consentement du locataire a la quittance electronique (conformite legale :
-- la remise dematerialisee de la quittance exige l'accord expres du locataire).
--
-- Principe : au PREMIER acces a un lien /recu/<token>, un ecran de
-- consentement intercepte l'affichage. L'accord est enregistre UNE FOIS par
-- locataire (pas par quittance), horodate, IMMUABLE :
--   - table append-only : aucun grant UPDATE/DELETE, trigger de verrou en
--     ceinture et bretelles (meme un chemin service_role ne peut pas modifier
--     un accord sans DROP explicite du trigger) ;
--   - le libelle accepte est stocke verbatim (valeur probante : on sait
--     exactement ce qui a ete accepte, meme si la copy change plus tard) ;
--   - ecritures uniquement via RPC SECURITY DEFINER cle sur le token UUID
--     (modele ADR-013, decalque de get_receipt_by_token) ; l'anon ne touche
--     aucune table.
--
-- La RPC de statut ne marque PAS le recu comme lu : la quittance n'est
-- consideree remise qu'apres consentement (get_receipt_by_token, qui pose
-- read, n'est appelee qu'ensuite).

begin;

-- ── 1. Table append-only ────────────────────────────────────────────────────

create table public.tenant_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  kind text not null check (kind in ('ereceipt')),
  wording text not null,
  granted_at timestamptz not null default now(),
  via_receipt_id uuid references public.receipts(id) on delete set null,
  unique (tenant_id, kind)
);

comment on table public.tenant_consents is
  'Consentements du locataire (append-only). ereceipt = accord expres pour la '
  'remise electronique des quittances via Ranti. granted_at immuable (trigger).';
comment on column public.tenant_consents.wording is
  'Libelle exact accepte, stocke verbatim (valeur probante).';

create index tenant_consents_tenant_idx on public.tenant_consents(tenant_id);

alter table public.tenant_consents enable row level security;

-- Le bailleur peut LIRE les consentements de ses locataires (preuve).
create policy "Landlords read own tenants consents" on public.tenant_consents
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_consents.tenant_id
        and t.landlord_id = private.current_landlord_id()
    )
  );

grant select on public.tenant_consents to authenticated;
-- Aucun grant INSERT/UPDATE/DELETE : ecritures via RPC SECURITY DEFINER seulement.

-- ── 2. Immutabilite : un accord ne se modifie ni ne s'efface ────────────────

create function private.tenant_consents_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'consent_immutable' using errcode = 'P0001';
end;
$$;

create trigger tenant_consents_lock
  before update or delete on public.tenant_consents
  for each row execute function private.tenant_consents_immutable();

-- ── 3. Statut par token (SANS marquer le recu lu) ───────────────────────────

create function public.ereceipt_consent_status(p_token uuid)
returns table (found boolean, granted_at timestamptz, tenant_first_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_first text;
  v_granted timestamptz;
begin
  select rec.tenant_id, r.snapshot->'tenant'->>'first_name'
    into v_tenant, v_first
  from public.receipts r
  join public.rent_receptions rec on rec.id = r.rent_reception_id
  where r.tenant_token = p_token and r.deleted_at is null;

  if v_tenant is null then
    return query select false, null::timestamptz, null::text;
    return;
  end if;

  select c.granted_at into v_granted
  from public.tenant_consents c
  where c.tenant_id = v_tenant and c.kind = 'ereceipt';

  return query select true, v_granted, v_first;
end;
$$;

-- ── 4. Accord par token : write-once, idempotent ────────────────────────────

create function public.grant_ereceipt_consent(p_token uuid, p_wording text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_receipt uuid;
  v_granted timestamptz;
begin
  if p_wording is null or length(trim(p_wording)) < 10 then
    raise exception 'wording_required' using errcode = 'P0001';
  end if;

  select rec.tenant_id, r.id into v_tenant, v_receipt
  from public.receipts r
  join public.rent_receptions rec on rec.id = r.rent_reception_id
  where r.tenant_token = p_token and r.deleted_at is null;

  if v_tenant is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Write-once : un rejeu (double-tap, rechargement) renvoie l'horodatage
  -- d'origine, jamais un nouveau. Le trigger interdit toute modification.
  insert into public.tenant_consents (tenant_id, kind, wording, via_receipt_id)
  values (v_tenant, 'ereceipt', trim(p_wording), v_receipt)
  on conflict (tenant_id, kind) do nothing;

  select c.granted_at into v_granted
  from public.tenant_consents c
  where c.tenant_id = v_tenant and c.kind = 'ereceipt';

  return v_granted;
end;
$$;

grant execute on function public.ereceipt_consent_status(uuid) to anon, authenticated;
grant execute on function public.grant_ereceipt_consent(uuid, text) to anon, authenticated;

commit;
