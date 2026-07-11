-- ADR-014 : collage SMS Mobile Money + journal en flux (vue de projection).
--
-- Deux briques, zéro table intermédiaire :
--   1. Déduplication du collage SMS via un index unique partiel sur la colonne
--      rent_receptions.payment_reference qui EXISTE DÉJÀ (ne pas recréer une
--      colonne transaction_ref : ce serait de la dérive de schéma — cf. ADR-014).
--   2. journal_feed : vue UNION chronologique des événements du registre. Pas de
--      double écriture, rien à backfiller ; l'immutabilité vit déjà dans les
--      tables sources (statuts cancelled/reversed, audit_logs — ADR-005).

begin;

-- 1) Déduplication du SMS collé deux fois -----------------------------------
--
-- Portée par landlord : deux propriétaires distincts peuvent légitimement voir
-- passer la même référence d'opérateur. Partiel : on n'indexe que les lignes
-- vivantes porteuses d'une référence. Une 2e insertion de la même référence
-- lève 23505 (unique_violation) → l'appelant la traite comme « déjà encaissé ».
create unique index if not exists rent_receptions_landlord_payment_reference_uq
  on public.rent_receptions (landlord_id, payment_reference)
  where payment_reference is not null and deleted_at is null;

-- 2) journal_feed : projection en lecture seule -----------------------------
--
-- security_invoker = true (PG15+) : la vue s'exécute avec les droits DU
-- propriétaire qui interroge, donc la RLS de CHAQUE table source s'applique.
-- Sans ça, la vue tournerait avec les droits du propriétaire de l'objet et
-- fuiterait le registre de tous les bailleurs. Non négociable.
create or replace view public.journal_feed
with (security_invoker = true) as

  -- Bail : la clé de voûte. Événement daté à sa prise d'effet.
  select
    l.landlord_id                     as landlord_id,
    'lease_started'::text             as event_type,
    l.start_date::timestamptz         as occurred_at,
    'Bail pris en compte'::text       as label,
    l.monthly_rent_amount             as amount,
    l.currency                        as currency,
    'leases'::text                    as ref_table,
    l.id                              as ref_id
  from public.leases l
  where l.deleted_at is null
    and l.status in ('active', 'ended')

  union all

  -- Échéance de loyer générée.
  select
    d.landlord_id,
    'rent_due',
    d.due_date::timestamptz,
    'Loyer attendu',
    d.amount_due,
    d.currency,
    'rent_dues',
    d.id
  from public.rent_dues d
  where d.deleted_at is null
    and d.status <> 'cancelled'

  union all

  -- Encaissement confirmé (saisie propriétaire / vocal / SMS / opérateur).
  select
    r.landlord_id,
    'rent_reception',
    r.received_at,
    'Encaissement',
    r.amount_received,
    r.currency,
    'rent_receptions',
    r.id
  from public.rent_receptions r
  where r.deleted_at is null
    and r.status = 'confirmed'

  union all

  -- Quittance émise.
  select
    q.landlord_id,
    'receipt',
    q.issued_at,
    'Quittance émise',
    q.total_amount,
    q.currency,
    'receipts',
    q.id
  from public.receipts q
  where q.deleted_at is null
    and q.status = 'issued'

  union all

  -- Relance automatique (SMS / WhatsApp — table reminders).
  select
    m.landlord_id,
    'reminder',
    m.sent_at,
    'Relance envoyée',
    null::integer,
    null::text,
    'reminders',
    m.id
  from public.reminders m
  where m.status <> 'failed'

  union all

  -- Relance manuelle WhatsApp (table reminder_events, cockpit opérateur).
  select
    e.landlord_id,
    'reminder',
    e.sent_at,
    'Relance envoyée',
    null::integer,
    null::text,
    'reminder_events',
    e.id
  from public.reminder_events e;

-- La vue n'a pas de RLS propre : elle défère aux tables sources via
-- security_invoker. Mais PostgREST exige quand même le GRANT table, sinon 403
-- AVANT toute évaluation RLS (piège policy-sans-grant, cf. incident PR #90).
grant select on public.journal_feed to authenticated;

commit;
