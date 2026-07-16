-- ADR-023 (phase Expand) — Grand Livre de Confiance : table `transactions`.
--
-- Toute somme due ou reçue sur un bail devient une ligne d'un même grand
-- livre. Cette migration N'EST PAS la bascule : les tables héritées
-- (rent_dues, rent_receptions, rent_reception_allocations) restent la source
-- de vérité et les flux existants ne changent pas. Le grand livre est tenu à
-- l'identique par :
--   1. un BACKFILL idempotent (clé `legacy_ref`) qui projette l'existant,
--      y compris les annulations passées (paires ligne + contre-passation —
--      on ne réécrit pas l'histoire, ADR-005) ;
--   2. des TRIGGERS MIROIR sur les tables héritées (la double écriture vit en
--      base, pas dans les server actions : les RPC SQL comme
--      generate_rent_dues ou verify_payment_transaction sont ainsi couvertes
--      d'office, quel que soit le chemin d'appel) ;
--   3. une FONCTION DE VÉRIFICATION d'égalité des soldes, exécutée en fin de
--      migration : tout écart entre solde legacy et solde ledger FAIT ÉCHOUER
--      la migration (critère de non-bascule de l'ADR-023).
--
-- Machine à états (ADR-023 §4) : pending → validated | disputed | withdrawn ;
-- disputed → validated (retrait de contestation) | withdrawn ; `validated` et
-- `withdrawn` sont terminaux (triggers durs). Une ligne validée ne se corrige
-- que par contre-passation (nouvelle ligne, reversal_of).
--
-- Granularité transitoire : une ligne de crédit par ALLOCATION (la projection
-- fidèle du modèle hérité) ; l'argent confirmé non affecté (fast-log ADR-014)
-- n'entre pas encore au grand livre par bail — il reste visible au journal.
-- La quittance et l'acquittement locataire (ADR-013) sont inchangés.
--
-- Rollback : forward-only (pas de down). Aucune donnée détruite ; retour
-- arrière = ignorer la table (aucune lecture applicative ne pointe dessus
-- avant la phase « Nouvelle lecture »).

begin;

-- -----------------------------------------------------------------------------
-- 1. Table transactions (ADR-023 §1)
-- -----------------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id),
  lease_id uuid not null references public.leases(id),
  type text not null
    check (type in ('loyer', 'reparation', 'frais', 'reglement', 'contre_passation')),
  direction text not null check (direction in ('debit', 'credit')),
  amount integer not null check (amount > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  -- Date de l'événement économique (échéance créée, argent reçu) — l'ordre du
  -- relevé. created_at reste la date d'écriture.
  occurred_at timestamptz not null default now(),
  due_date date,
  period_start date,
  period_end date,
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'disputed', 'withdrawn')),
  validated_by text check (validated_by in ('landlord', 'tenant', 'system')),
  validated_at timestamptz,
  disputed_at timestamptz,
  contest_nature text
    check (contest_nature in ('amount', 'not_owed', 'already_paid', 'other')),
  contested_amount integer check (contested_amount is null or contested_amount >= 0),
  tenant_comment text,
  resolution text
    check (resolution in ('retrait_contestation', 'retrait_auteur', 'remplacement')),
  resolved_at timestamptz,
  reversal_of uuid references public.transactions(id),
  replaced_by uuid references public.transactions(id),
  -- Accès public locataire (Valider/Contester, phase « différenciant ») —
  -- posé plus tard sur les lignes soumises à validation, jamais au backfill.
  tenant_token uuid unique,
  source text not null
    check (source in ('genere_par_bail', 'manuel', 'feexpay', 'declaration_locataire')),
  label text not null check (length(btrim(label)) > 0),
  -- Clé de correspondance avec le modèle hérité (backfill idempotent + miroir).
  -- Transitoire : tombera à la phase Contract avec les tables héritées.
  legacy_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Cohérence type/direction : les dettes sont des débits, les règlements des
  -- crédits ; une contre-passation prend le sens inverse de sa cible.
  constraint transactions_type_direction check (
    (type in ('loyer', 'reparation', 'frais') and direction = 'debit')
    or (type = 'reglement' and direction = 'credit')
    or (type = 'contre_passation')
  ),
  -- reversal_of ⟺ contre_passation, dans les deux sens.
  constraint transactions_reversal_iff_contre_passation check (
    (type = 'contre_passation') = (reversal_of is not null)
  ),
  -- Le mois couvert n'a de sens que pour un loyer (règles ADR-004).
  constraint transactions_period_only_loyer check (
    (type = 'loyer' and period_start is not null and period_end is not null
      and period_end >= period_start and due_date is not null)
    or (type <> 'loyer' and period_start is null and period_end is null)
  ),
  -- Une exigibilité ne se pose que sur un débit.
  constraint transactions_due_date_debit_only check (
    direction = 'debit' or due_date is null
  ),
  -- Statut ⟺ métadonnées de transition (ADR-023 §4).
  constraint transactions_validated_fields check (
    (status = 'validated') = (validated_by is not null and validated_at is not null)
  ),
  constraint transactions_disputed_fields check (
    status <> 'disputed' or (disputed_at is not null and contest_nature is not null)
  ),
  -- L'historique de contestation survit au retrait (deux voix, ADR-013) mais
  -- ne peut exister sans passage par l'état disputed.
  constraint transactions_contest_needs_dispute check (
    contest_nature is null or disputed_at is not null
  ),
  constraint transactions_withdrawn_fields check (
    status <> 'withdrawn'
    or (resolution in ('retrait_auteur', 'remplacement') and resolved_at is not null)
  ),
  constraint transactions_resolution_timestamps check (
    (resolution is null) = (resolved_at is null)
  ),
  constraint transactions_replacement_link check (
    (resolution = 'remplacement' and replaced_by is not null)
    or (resolution is distinct from 'remplacement' and replaced_by is null)
  ),
  -- Une ligne pending est vierge de toute métadonnée de transition.
  constraint transactions_pending_is_pristine check (
    status <> 'pending'
    or (validated_by is null and disputed_at is null and resolution is null)
  )
);

create index transactions_landlord_occurred_idx
  on public.transactions (landlord_id, occurred_at desc);
create index transactions_lease_occurred_idx
  on public.transactions (lease_id, occurred_at desc);
create unique index transactions_legacy_ref_uq
  on public.transactions (legacy_ref) where legacy_ref is not null;
create index transactions_reversal_of_idx
  on public.transactions (reversal_of) where reversal_of is not null;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- Données financières sensibles : chaque écriture/transition est auditée
-- (ADR-006), comme payment_transactions.
create trigger transactions_audit
after insert or update on public.transactions
for each row execute function private.log_audit();

-- RLS : un propriétaire ne lit que son grand livre. Aucun grant d'écriture
-- client : pendant l'expand, seuls le backfill et les triggers miroir
-- (SECURITY DEFINER) écrivent — même doctrine que payment_transactions.
alter table public.transactions enable row level security;

create policy transactions_select_own on public.transactions
  for select using (landlord_id = private.current_landlord_id());

revoke all on table public.transactions from public, anon, authenticated;
grant select on table public.transactions to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Backfill idempotent — projection de l'existant (ADR-023 § Transition).
--    Statuts dérivés de la matrice de validation (§3) :
--      due active            → débit loyer validated(system)          [ligne 1]
--      due annulée/archivée  → débit + contre-passation validated     [historique]
--      alloc. confirmée      → crédit validated(landlord|system)      [lignes 3-4]
--      alloc. de brouillon   → crédit pending                         [ligne 5]
--      réception annulée     → confirmée un jour : paire crédit + contre-passation ;
--                              jamais confirmée : crédit withdrawn (retrait auteur)
--    Rejouable : chaque ligne porte un legacy_ref unique, on conflict do nothing.
--    (Les triggers de machine à états sont créés APRÈS : le backfill est le
--    seul autorisé à écrire l'histoire telle qu'elle fut, withdrawn compris.)
-- -----------------------------------------------------------------------------

-- 2a. Débits loyer : toutes les échéances, y compris annulées/archivées.
insert into public.transactions (
  landlord_id, lease_id, type, direction, amount, currency, occurred_at,
  due_date, period_start, period_end, status, validated_by, validated_at,
  source, label, legacy_ref
)
select
  d.landlord_id, d.lease_id, 'loyer', 'debit', d.amount_due, d.currency,
  d.created_at, d.due_date, d.period_start, d.period_end,
  'validated', 'system', d.created_at,
  'genere_par_bail',
  'Loyer ' || to_char(d.period_start, 'YYYY-MM'),
  'due:' || d.id
from public.rent_dues d
on conflict (legacy_ref) where legacy_ref is not null do nothing;

-- 2b. Contre-passation des échéances annulées (motif repris).
insert into public.transactions (
  landlord_id, lease_id, type, direction, amount, currency, occurred_at,
  status, validated_by, validated_at, reversal_of, source, label, legacy_ref
)
select
  d.landlord_id, d.lease_id, 'contre_passation', 'credit', t.amount, t.currency,
  d.updated_at, 'validated', 'system', d.updated_at, t.id, 'genere_par_bail',
  'Échéance annulée — ' || coalesce(nullif(btrim(d.cancelled_reason), ''), 'sans motif'),
  'due:' || d.id || ':cancel'
from public.rent_dues d
join public.transactions t on t.legacy_ref = 'due:' || d.id
where d.status = 'cancelled'
on conflict (legacy_ref) where legacy_ref is not null do nothing;

-- 2c. Contre-passation des échéances archivées (non annulées).
insert into public.transactions (
  landlord_id, lease_id, type, direction, amount, currency, occurred_at,
  status, validated_by, validated_at, reversal_of, source, label, legacy_ref
)
select
  d.landlord_id, d.lease_id, 'contre_passation', 'credit', t.amount, t.currency,
  coalesce(d.deleted_at, now()), 'validated', 'system',
  coalesce(d.deleted_at, now()), t.id, 'genere_par_bail',
  'Échéance archivée', 'due:' || d.id || ':archive:v1'
from public.rent_dues d
join public.transactions t on t.legacy_ref = 'due:' || d.id
where d.deleted_at is not null and d.status <> 'cancelled'
on conflict (legacy_ref) where legacy_ref is not null do nothing;

-- 2d. Crédits : une ligne par allocation, rattachée au bail via l'échéance.
--     Le statut suit la réception ; la source suit recorded_by (psp → rail).
insert into public.transactions (
  landlord_id, lease_id, type, direction, amount, currency, occurred_at,
  status, validated_by, validated_at, resolution, resolved_at,
  source, label, legacy_ref
)
select
  a.landlord_id, d.lease_id, 'reglement', 'credit', a.amount_allocated,
  r.currency, r.received_at,
  case
    when r.status = 'confirmed' and r.deleted_at is null then 'validated'
    when r.status = 'draft' and r.deleted_at is null then 'pending'
    when r.status = 'cancelled' and r.confirmed_at is not null then 'validated'
    else 'withdrawn'  -- brouillon annulé ou archivé : jamais devenu certain
  end,
  case
    when (r.status = 'confirmed' and r.deleted_at is null)
      or (r.status = 'cancelled' and r.confirmed_at is not null)
    then case when coalesce(r.recorded_by, 'landlord') = 'psp' then 'system' else 'landlord' end
  end,
  case
    when (r.status = 'confirmed' and r.deleted_at is null)
      or (r.status = 'cancelled' and r.confirmed_at is not null)
    then coalesce(r.confirmed_at, r.received_at)
  end,
  case
    when (r.status = 'cancelled' and r.confirmed_at is null)
      or (r.status = 'draft' and r.deleted_at is not null)
    then 'retrait_auteur'
  end,
  case
    when (r.status = 'cancelled' and r.confirmed_at is null)
      or (r.status = 'draft' and r.deleted_at is not null)
    then coalesce(r.cancelled_at, r.deleted_at, now())
  end,
  case coalesce(r.recorded_by, 'landlord')
    when 'psp' then 'feexpay'
    when 'tenant' then 'declaration_locataire'
    else 'manuel'
  end,
  'Règlement — ' || case r.payment_method
    when 'cash' then 'espèces'
    when 'mobile_money' then 'mobile money'
    when 'bank_transfer' then 'virement'
    else 'autre'
  end,
  'alloc:' || a.id
from public.rent_reception_allocations a
join public.rent_receptions r on r.id = a.rent_reception_id
join public.rent_dues d on d.id = a.rent_due_id
on conflict (legacy_ref) where legacy_ref is not null do nothing;

-- 2e. Contre-passation des crédits dont la réception, un jour confirmée, a été
--     annulée (ADR-005) ou archivée — l'histoire reste lisible des deux côtés.
insert into public.transactions (
  landlord_id, lease_id, type, direction, amount, currency, occurred_at,
  status, validated_by, validated_at, reversal_of, source, label, legacy_ref
)
select
  t.landlord_id, t.lease_id, 'contre_passation', 'debit', t.amount, t.currency,
  coalesce(r.cancelled_at, r.deleted_at, now()), 'validated', 'landlord',
  coalesce(r.cancelled_at, r.deleted_at, now()), t.id, t.source,
  case
    when r.status = 'cancelled'
    then 'Encaissement annulé — ' || coalesce(nullif(btrim(r.cancellation_reason), ''), 'sans motif')
    else 'Encaissement archivé'
  end,
  'alloc:' || a.id || case when r.status = 'cancelled' then ':cancel' else ':archive:v1' end
from public.rent_reception_allocations a
join public.rent_receptions r on r.id = a.rent_reception_id
join public.transactions t on t.legacy_ref = 'alloc:' || a.id
where t.status = 'validated'
  and (r.status = 'cancelled' or r.deleted_at is not null)
  and r.confirmed_at is not null
on conflict (legacy_ref) where legacy_ref is not null do nothing;

-- -----------------------------------------------------------------------------
-- 3. Machine à états (ADR-023 §4) — créée après le backfill : à partir d'ici,
--    une ligne naît pending ou validated, et l'histoire ne se réécrit plus.
-- -----------------------------------------------------------------------------

create or replace function private.enforce_transactions_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  already_reversed integer;
begin
  -- Une ligne naît pending ou validated ; disputed/withdrawn n'existent que
  -- par transition (la ligne doit avoir été notifiable avant d'être discutée).
  if new.status not in ('pending', 'validated') then
    raise exception 'transaction_invalid_birth_status' using errcode = 'P0001';
  end if;

  if new.type = 'contre_passation' then
    select * into target from public.transactions where id = new.reversal_of;
    if not found then
      raise exception 'reversal_target_not_found' using errcode = 'P0002';
    end if;
    if target.lease_id <> new.lease_id or target.landlord_id <> new.landlord_id then
      raise exception 'reversal_target_mismatch' using errcode = 'P0001';
    end if;
    -- On ne contre-passe qu'une ligne certaine (le pending se retire, ADR-023 §3),
    -- et jamais une contre-passation (corriger une correction = réémettre).
    if target.status <> 'validated' or target.type = 'contre_passation' then
      raise exception 'reversal_target_not_reversible' using errcode = 'P0001';
    end if;
    if new.direction = target.direction then
      raise exception 'reversal_same_direction' using errcode = 'P0001';
    end if;
    select coalesce(sum(r.amount), 0) into already_reversed
    from public.transactions r
    where r.reversal_of = target.id and r.status <> 'withdrawn';
    if already_reversed + new.amount > target.amount then
      raise exception 'reversal_exceeds_target' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_transactions_insert() from public, anon, authenticated;

create trigger trg_transactions_insert_guard
  before insert on public.transactions
  for each row execute function private.enforce_transactions_insert();

create or replace function private.enforce_transactions_state_machine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Aucune ligne du grand livre ne disparaît, quel que soit son statut.
    raise exception 'transaction_no_delete'
      using errcode = 'P0001',
            hint = 'le grand livre est append-only ; corriger = contre-passer ou retirer';
  end if;

  -- validated et withdrawn sont terminaux (ADR-023 §4).
  if old.status in ('validated', 'withdrawn') then
    raise exception 'transaction_terminal'
      using errcode = 'P0001',
            hint = 'une ligne validée ne se corrige que par contre-passation';
  end if;

  -- L'identité financière d'une ligne est gelée dès l'insertion : on ne
  -- modifie pas une ligne que l'autre partie a pu lire — on retire et on
  -- réémet (ADR-023, alternative rejetée « correction par édition »).
  if new.landlord_id  is distinct from old.landlord_id
    or new.lease_id     is distinct from old.lease_id
    or new.type         is distinct from old.type
    or new.direction    is distinct from old.direction
    or new.amount       is distinct from old.amount
    or new.currency     is distinct from old.currency
    or new.occurred_at  is distinct from old.occurred_at
    or new.due_date     is distinct from old.due_date
    or new.period_start is distinct from old.period_start
    or new.period_end   is distinct from old.period_end
    or new.reversal_of  is distinct from old.reversal_of
    or new.source       is distinct from old.source
    or new.label        is distinct from old.label
    or new.legacy_ref   is distinct from old.legacy_ref
    or new.created_at   is distinct from old.created_at
  then
    raise exception 'transaction_immutable' using errcode = 'P0001';
  end if;

  -- Transitions autorisées — tout le reste est refusé.
  if old.status = 'pending' and new.status in ('pending', 'validated', 'disputed', 'withdrawn') then
    null;
  elsif old.status = 'disputed' and new.status = 'withdrawn' then
    null;
  elsif old.status = 'disputed' and new.status = 'validated' then
    -- Seule sortie disputed → validated : le retrait de la contestation.
    if new.resolution is distinct from 'retrait_contestation' then
      raise exception 'transaction_invalid_transition' using errcode = 'P0001';
    end if;
  elsif old.status = 'disputed' and new.status = 'disputed' then
    null; -- pose de token, complément de commentaire : la ligne reste gelée par ailleurs
  else
    raise exception 'transaction_invalid_transition' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_transactions_state_machine() from public, anon, authenticated;

create trigger trg_transactions_state_machine
  before update or delete on public.transactions
  for each row execute function private.enforce_transactions_state_machine();

-- -----------------------------------------------------------------------------
-- 4. Triggers miroir — la double écriture vit en base (SECURITY DEFINER,
--    même transaction que l'écriture héritée : atomique par construction).
-- -----------------------------------------------------------------------------

-- Réf. séquencée pour les événements répétables (archive/restauration, réémission).
create or replace function private.ledger_seq_ref(p_base text)
returns text
language sql
security definer
set search_path = ''
as $$
  select p_base || ':v' || (
    (select count(*) from public.transactions where legacy_ref like p_base || ':v%') + 1
  )::text
$$;

revoke all on function private.ledger_seq_ref(text) from public, anon, authenticated;

-- Ligne active (non contre-passée) d'une entité héritée.
create or replace function private.ledger_active_line(p_ref_prefix text, p_type text)
returns public.transactions
language sql
security definer
set search_path = ''
as $$
  select t.* from public.transactions t
  where t.legacy_ref like p_ref_prefix || '%'
    and t.type = p_type
    and t.status in ('pending', 'validated')
    and not exists (
      select 1 from public.transactions r
      where r.reversal_of = t.id and r.status <> 'withdrawn'
    )
  order by t.created_at desc
  limit 1
$$;

revoke all on function private.ledger_active_line(text, text) from public, anon, authenticated;

-- Contre-passe une ligne validée (annulation, archivage, réécriture héritée).
create or replace function private.ledger_reverse_line(
  p_line public.transactions,
  p_label text,
  p_ref text,
  p_by text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.transactions (
    landlord_id, lease_id, type, direction, amount, currency, occurred_at,
    status, validated_by, validated_at, reversal_of, source, label, legacy_ref
  )
  values (
    p_line.landlord_id, p_line.lease_id, 'contre_passation',
    case p_line.direction when 'debit' then 'credit' else 'debit' end,
    p_line.amount, p_line.currency, now(),
    'validated', p_by, now(), p_line.id, p_line.source, p_label, p_ref
  )
  on conflict (legacy_ref) where legacy_ref is not null do nothing;
end;
$$;

revoke all on function private.ledger_reverse_line(public.transactions, text, text, text)
  from public, anon, authenticated;

-- 4a. Miroir des échéances : le bail crée les débits loyer (matrice ligne 1).
create or replace function private.mirror_rent_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.transactions;
begin
  if tg_op = 'INSERT' then
    if new.status = 'cancelled' or new.deleted_at is not null then
      return new;
    end if;
    insert into public.transactions (
      landlord_id, lease_id, type, direction, amount, currency, occurred_at,
      due_date, period_start, period_end, status, validated_by, validated_at,
      source, label, legacy_ref
    )
    values (
      new.landlord_id, new.lease_id, 'loyer', 'debit', new.amount_due,
      new.currency, coalesce(new.created_at, now()), new.due_date,
      new.period_start, new.period_end, 'validated', 'system',
      coalesce(new.created_at, now()), 'genere_par_bail',
      'Loyer ' || to_char(new.period_start, 'YYYY-MM'), 'due:' || new.id
    )
    on conflict (legacy_ref) where legacy_ref is not null do nothing;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Défensif : aucun flux client ne supprime une échéance (pas de policy
    -- DELETE) ; si une intervention le fait, le grand livre garde la trace.
    line := private.ledger_active_line('due:' || old.id, 'loyer');
    if line.id is not null then
      perform private.ledger_reverse_line(
        line, 'Échéance supprimée', 'due:' || old.id || ':delete', 'system');
    end if;
    return old;
  end if;

  -- UPDATE ------------------------------------------------------------------
  -- Annulation (cancel_rent_due) : contre-passation, motif repris.
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    line := private.ledger_active_line('due:' || new.id, 'loyer');
    if line.id is not null then
      perform private.ledger_reverse_line(
        line,
        'Échéance annulée — ' || coalesce(nullif(btrim(new.cancelled_reason), ''), 'sans motif'),
        'due:' || new.id || ':cancel', 'system');
    end if;
    return new;
  end if;

  -- Archivage / restauration (policies 007).
  if new.deleted_at is not null and old.deleted_at is null then
    line := private.ledger_active_line('due:' || new.id, 'loyer');
    if line.id is not null then
      perform private.ledger_reverse_line(
        line, 'Échéance archivée',
        private.ledger_seq_ref('due:' || new.id || ':archive'), 'system');
    end if;
    return new;
  end if;

  if new.deleted_at is null and old.deleted_at is not null and new.status <> 'cancelled' then
    line := private.ledger_active_line('due:' || new.id, 'loyer');
    if line.id is null then
      insert into public.transactions (
        landlord_id, lease_id, type, direction, amount, currency, occurred_at,
        due_date, period_start, period_end, status, validated_by, validated_at,
        source, label, legacy_ref
      )
      values (
        new.landlord_id, new.lease_id, 'loyer', 'debit', new.amount_due,
        new.currency, now(), new.due_date, new.period_start, new.period_end,
        'validated', 'system', now(), 'genere_par_bail',
        'Loyer ' || to_char(new.period_start, 'YYYY-MM'),
        private.ledger_seq_ref('due:' || new.id || ':restore')
      );
    end if;
    return new;
  end if;

  -- Réécriture financière (possible seulement sans allocation, ADR-004) :
  -- contre-passation + réémission — jamais d'édition de la ligne miroir.
  if (new.amount_due is distinct from old.amount_due
      or new.due_date is distinct from old.due_date
      or new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end
      or new.lease_id is distinct from old.lease_id
      or new.currency is distinct from old.currency)
    and new.status <> 'cancelled' and new.deleted_at is null
  then
    line := private.ledger_active_line('due:' || new.id, 'loyer');
    if line.id is not null then
      perform private.ledger_reverse_line(
        line, 'Échéance corrigée',
        private.ledger_seq_ref('due:' || new.id || ':rev'), 'system');
    end if;
    insert into public.transactions (
      landlord_id, lease_id, type, direction, amount, currency, occurred_at,
      due_date, period_start, period_end, status, validated_by, validated_at,
      source, label, legacy_ref
    )
    values (
      new.landlord_id, new.lease_id, 'loyer', 'debit', new.amount_due,
      new.currency, now(), new.due_date, new.period_start, new.period_end,
      'validated', 'system', now(), 'genere_par_bail',
      'Loyer ' || to_char(new.period_start, 'YYYY-MM'),
      private.ledger_seq_ref('due:' || new.id || ':re')
    );
    return new;
  end if;

  -- Transitions de statut système (expected/overdue/paid), notes : sans effet
  -- comptable — le retard du grand livre se calcule sur due_date.
  return new;
end;
$$;

revoke all on function private.mirror_rent_due() from public, anon, authenticated;

create trigger trg_mirror_rent_due
  after insert or update or delete on public.rent_dues
  for each row execute function private.mirror_rent_due();

-- 4b. Miroir des allocations : chaque affectation crédite le bail
--     (matrice lignes 3-5 ; le statut suit la réception porteuse).
create or replace function private.mirror_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rent_receptions;
  v_lease uuid;
  line public.transactions;
begin
  if tg_op = 'DELETE' then
    line := private.ledger_active_line('alloc:' || old.id, 'reglement');
    if line.id is not null then
      if line.status = 'pending' then
        update public.transactions
        set status = 'withdrawn', resolution = 'retrait_auteur', resolved_at = now()
        where id = line.id;
      else
        perform private.ledger_reverse_line(
          line, 'Affectation retirée',
          private.ledger_seq_ref('alloc:' || old.id || ':rev'), 'landlord');
      end if;
    end if;
    return old;
  end if;

  select * into r from public.rent_receptions where id = new.rent_reception_id;
  select d.lease_id into v_lease from public.rent_dues d where d.id = new.rent_due_id;

  if tg_op = 'UPDATE' then
    -- Défensif : aucun flux ne modifie une allocation ; si cela arrive,
    -- contre-passation + réémission comme pour les échéances.
    if new.amount_allocated is distinct from old.amount_allocated
      or new.rent_due_id is distinct from old.rent_due_id
    then
      line := private.ledger_active_line('alloc:' || new.id, 'reglement');
      if line.id is not null then
        if line.status = 'pending' then
          update public.transactions
          set status = 'withdrawn', resolution = 'retrait_auteur', resolved_at = now()
          where id = line.id;
        else
          perform private.ledger_reverse_line(
            line, 'Affectation corrigée',
            private.ledger_seq_ref('alloc:' || new.id || ':rev'), 'landlord');
        end if;
      end if;
    else
      return new;
    end if;
  end if;

  -- INSERT (ou réémission après UPDATE) — uniquement si la réception est vivante.
  if r.id is null or r.deleted_at is not null or r.status = 'cancelled' then
    return new;
  end if;

  insert into public.transactions (
    landlord_id, lease_id, type, direction, amount, currency, occurred_at,
    status, validated_by, validated_at, source, label, legacy_ref
  )
  values (
    new.landlord_id, v_lease, 'reglement', 'credit', new.amount_allocated,
    r.currency, r.received_at,
    case when r.status = 'confirmed' then 'validated' else 'pending' end,
    case when r.status = 'confirmed'
      then case when coalesce(r.recorded_by, 'landlord') = 'psp' then 'system' else 'landlord' end
    end,
    case when r.status = 'confirmed' then coalesce(r.confirmed_at, now()) end,
    case coalesce(r.recorded_by, 'landlord')
      when 'psp' then 'feexpay'
      when 'tenant' then 'declaration_locataire'
      else 'manuel'
    end,
    'Règlement — ' || case r.payment_method
      when 'cash' then 'espèces'
      when 'mobile_money' then 'mobile money'
      when 'bank_transfer' then 'virement'
      else 'autre'
    end,
    case when tg_op = 'INSERT' then 'alloc:' || new.id
         else private.ledger_seq_ref('alloc:' || new.id || ':re') end
  )
  on conflict (legacy_ref) where legacy_ref is not null do nothing;

  return new;
end;
$$;

revoke all on function private.mirror_allocation() from public, anon, authenticated;

create trigger trg_mirror_allocation
  after insert or update or delete on public.rent_reception_allocations
  for each row execute function private.mirror_allocation();

-- 4c. Miroir des réceptions : confirmation, annulation, archivage.
create or replace function private.mirror_reception()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  line public.transactions;
  v_by text := case when coalesce(new.recorded_by, 'landlord') = 'psp' then 'system' else 'landlord' end;
begin
  -- draft → confirmed : les crédits pending deviennent certains
  -- (déclaration contre son propre intérêt / rail — matrice lignes 3-5).
  if new.status = 'confirmed' and old.status = 'draft' and new.deleted_at is null then
    for a in select al.id from public.rent_reception_allocations al
             where al.rent_reception_id = new.id
    loop
      line := private.ledger_active_line('alloc:' || a.id, 'reglement');
      if line.id is not null and line.status = 'pending' then
        update public.transactions
        set status = 'validated', validated_by = v_by,
            validated_at = coalesce(new.confirmed_at, now())
        where id = line.id;
      end if;
    end loop;
    return new;
  end if;

  -- → cancelled (ADR-005) ou archivage : confirmé un jour → contre-passation ;
  -- jamais confirmé → retrait par l'auteur.
  if (new.status = 'cancelled' and old.status <> 'cancelled')
    or (new.deleted_at is not null and old.deleted_at is null and new.status <> 'cancelled')
  then
    for a in select al.id from public.rent_reception_allocations al
             where al.rent_reception_id = new.id
    loop
      line := private.ledger_active_line('alloc:' || a.id, 'reglement');
      if line.id is null then
        continue;
      end if;
      if line.status = 'pending' then
        update public.transactions
        set status = 'withdrawn', resolution = 'retrait_auteur',
            resolved_at = coalesce(new.cancelled_at, new.deleted_at, now())
        where id = line.id;
      else
        perform private.ledger_reverse_line(
          line,
          case when new.status = 'cancelled'
            then 'Encaissement annulé — '
              || coalesce(nullif(btrim(new.cancellation_reason), ''), 'sans motif')
            else 'Encaissement archivé'
          end,
          case when new.status = 'cancelled' then 'alloc:' || a.id || ':cancel'
               else private.ledger_seq_ref('alloc:' || a.id || ':archive') end,
          'landlord');
      end if;
    end loop;
    return new;
  end if;

  -- Restauration d'une réception archivée non annulée : réémission.
  if new.deleted_at is null and old.deleted_at is not null and new.status <> 'cancelled' then
    for a in select al.id, al.landlord_id, al.amount_allocated, d.lease_id
             from public.rent_reception_allocations al
             join public.rent_dues d on d.id = al.rent_due_id
             where al.rent_reception_id = new.id
    loop
      line := private.ledger_active_line('alloc:' || a.id, 'reglement');
      if line.id is null then
        insert into public.transactions (
          landlord_id, lease_id, type, direction, amount, currency, occurred_at,
          status, validated_by, validated_at, source, label, legacy_ref
        )
        values (
          a.landlord_id, a.lease_id, 'reglement', 'credit', a.amount_allocated,
          new.currency, new.received_at,
          case when new.status = 'confirmed' then 'validated' else 'pending' end,
          case when new.status = 'confirmed' then v_by end,
          case when new.status = 'confirmed' then coalesce(new.confirmed_at, now()) end,
          case coalesce(new.recorded_by, 'landlord')
            when 'psp' then 'feexpay'
            when 'tenant' then 'declaration_locataire'
            else 'manuel'
          end,
          'Règlement — ' || case new.payment_method
            when 'cash' then 'espèces'
            when 'mobile_money' then 'mobile money'
            when 'bank_transfer' then 'virement'
            else 'autre'
          end,
          private.ledger_seq_ref('alloc:' || a.id || ':restore')
        );
      end if;
    end loop;
    return new;
  end if;

  return new;
end;
$$;

revoke all on function private.mirror_reception() from public, anon, authenticated;

create trigger trg_mirror_reception
  after update on public.rent_receptions
  for each row execute function private.mirror_reception();

-- -----------------------------------------------------------------------------
-- 5. Vue lease_balances (ADR-023 §6) — trois nombres, jamais fusionnés.
--    security_invoker : la RLS de transactions s'applique au lecteur.
-- -----------------------------------------------------------------------------

create or replace view public.lease_balances
with (security_invoker = on) as
with tx as (
  -- Exigibilité effective : une contre-passation hérite de celle de sa cible
  -- (annuler une échéance FUTURE ne réduit pas l'impayé d'aujourd'hui ;
  -- annuler un encaissement le ré-augmente immédiatement). Un débit sans
  -- date (réparation, frais) est dû tout de suite.
  select t.*,
    case when t.type = 'contre_passation'
      then (tgt.due_date is null or tgt.due_date < current_date)
      else (t.due_date is null or t.due_date < current_date)
    end as due_now
  from public.transactions t
  left join public.transactions tgt on tgt.id = t.reversal_of
)
select
  l.id as lease_id,
  l.landlord_id,
  -- Solde certain : ce que les deux parties (ou le rail) reconnaissent.
  coalesce(sum(case when t.status = 'validated' and t.direction = 'credit' then t.amount
                    when t.status = 'validated' and t.direction = 'debit' then -t.amount
                    else 0 end), 0)::bigint as certain_balance,
  coalesce(sum(case when t.status = 'pending' and t.direction = 'debit' then t.amount else 0 end), 0)::bigint as pending_debits,
  coalesce(sum(case when t.status = 'pending' and t.direction = 'credit' then t.amount else 0 end), 0)::bigint as pending_credits,
  coalesce(sum(case when t.status = 'disputed' and t.direction = 'debit' then t.amount else 0 end), 0)::bigint as disputed_debits,
  coalesce(sum(case when t.status = 'disputed' and t.direction = 'credit' then t.amount else 0 end), 0)::bigint as disputed_credits,
  -- Impayé : lignes certaines exigibles aujourd'hui, débits moins crédits,
  -- plancher zéro. Pilote le dashboard et les relances.
  greatest(0, coalesce(sum(case when t.status = 'validated' and t.due_now
                                then case t.direction when 'debit' then t.amount else -t.amount end
                                else 0 end), 0))::bigint as overdue_amount
from public.leases l
left join tx t on t.lease_id = l.id
group by l.id, l.landlord_id;

revoke all on public.lease_balances from public, anon;
grant select on public.lease_balances to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Garde d'égalité (critère de non-bascule, ADR-023 § Transition) :
--    pour chaque bail, le solde certain du grand livre doit être l'exact
--    opposé du restant dû hérité. Tout écart fait échouer la migration.
-- -----------------------------------------------------------------------------

create or replace function private.verify_ledger_equality()
returns table (lease_id uuid, legacy_outstanding bigint, ledger_outstanding bigint)
language sql
security definer
set search_path = ''
as $$
  with legacy as (
    select d.lease_id,
      sum(d.amount_due)::bigint
        - coalesce(sum((
            select coalesce(sum(a.amount_allocated), 0)
            from public.rent_reception_allocations a
            join public.rent_receptions r on r.id = a.rent_reception_id
            where a.rent_due_id = d.id
              and r.status = 'confirmed'
              and r.deleted_at is null
          )), 0)::bigint as outstanding
    from public.rent_dues d
    where d.deleted_at is null and d.status <> 'cancelled'
    group by d.lease_id
  ),
  ledger as (
    select t.lease_id, (-1 * coalesce(sum(
      case when t.status = 'validated' and t.direction = 'credit' then t.amount
           when t.status = 'validated' and t.direction = 'debit' then -t.amount
           else 0 end), 0))::bigint as outstanding
    from public.transactions t
    group by t.lease_id
  )
  select coalesce(lg.lease_id, ld.lease_id),
         coalesce(lg.outstanding, 0),
         coalesce(ld.outstanding, 0)
  from legacy lg
  full outer join ledger ld on ld.lease_id = lg.lease_id
  where coalesce(lg.outstanding, 0) <> coalesce(ld.outstanding, 0)
$$;

revoke all on function private.verify_ledger_equality() from public, anon, authenticated;

do $$
declare
  n integer;
begin
  select count(*) into n from private.verify_ledger_equality();
  if n > 0 then
    raise exception 'ledger_equality_failed: % bail/baux en écart — voir private.verify_ledger_equality()', n;
  end if;
end;
$$;

commit;
