-- Prise en main guidée (FirstRun) — statut d'onboarding propriétaire.
--
-- Colonne NON-identité : le trigger `landlords_identity_lock` ne se déclenche
-- que sur `UPDATE OF first_name, last_name, civility, phone` (ADR-002), donc un
-- update de `onboarding_status` ne le réveille pas. La policy
-- `landlords_update_own` autorise déjà `authenticated` à écrire sa propre ligne
-- (même chemin que `payment_alias` / `deleted_at`). Aucun RPC requis.
--
-- États :
--   pending   — accueil pas encore vu (nouvelle inscription)
--   guided    — prise en main en cours (checklist « Premiers pas »)
--   exploring — « Passer pour l'instant » : tableau de bord vide honnête
--   done      — premiers pas terminés (ou repris puis terminés)
--
-- La PROGRESSION des étapes (bail / encaissement / quittance / relance) est
-- DÉRIVÉE des données réelles au rendu, jamais stockée ici (cf.
-- lib/onboarding/progress.ts). On ne persiste que l'intention (accueil vu,
-- skip, reprise, terminé).

begin;

alter table public.landlords
  add column if not exists onboarding_status text not null default 'pending';

alter table public.landlords
  drop constraint if exists landlords_onboarding_status_check;

alter table public.landlords
  add constraint landlords_onboarding_status_check
  check (onboarding_status in ('pending', 'guided', 'exploring', 'done'));

comment on column public.landlords.onboarding_status is
  'Prise en main guidée (welcome-flow.md) : pending|guided|exploring|done. '
  'Progression des étapes dérivée des données, non stockée.';

-- Propriétaires existants : déjà onboardés → pas d'accueil guidé.
update public.landlords
  set onboarding_status = 'done'
  where onboarding_status = 'pending';

commit;
