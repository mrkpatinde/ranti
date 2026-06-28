# ADR-004 — Règle de génération des échéances de loyer

## Statut

Accepté (CEO, 2026-06-28). Cœur métier — vigilance maximale.

## Contexte

Les échéances (`rent_dues`) naissent automatiquement du bail (`leases`). Le bug « début 29 juin → échéance 5 juin » a été corrigé (asymétrie début), mais `generate_rent_dues` **ignore encore `end_date`** : un bail terminé continue de générer des échéances jusqu'à aujourd'hui. La stratégie de génération doit être figée noir sur blanc avant toute nouvelle migration.

## Modèle period / due_date / end_date

Une échéance = **un mois de loyer**. Trois champs, trois rôles distincts :

| Champ | Sens | Règle |
|---|---|---|
| `period_start` | 1ᵉʳ jour du mois couvert | `date_trunc('month', mois)`. Clé d'identité avec `lease_id`. |
| `period_end` | dernier jour du mois couvert | `period_start + 1 mois - 1 jour`. Toujours dérivé, jamais saisi. |
| `due_date` | jour où le loyer est exigible | `least(due_day, dernier_jour_du_mois)` **dans ce mois**. Pilote le retard (`due_date < today → overdue`). |

## Décision — règle officielle (6 cas)

1. Bail commence le jour d'échéance ou avant (`day(start_date) ≤ due_day`) → première échéance **ce mois**.
2. Bail commence après le jour d'échéance (`day(start_date) > due_day`) → première échéance **le mois suivant**.
3. Le mois n'a pas le jour demandé → `due_date` = **dernier jour du mois** (clamp).
4. Le bail a une `end_date` → **aucune échéance après**. Borne haute = `least( mois(end_date), mois(today) )`.
5. Une échéance existe déjà (`lease_id, period_start`) → **pas de doublon** (`on conflict do nothing`).
6. Une échéance a des paiements alloués → **jamais réécrite silencieusement**.

## Règle produit MVP — asymétrie début/fin assumée

- **Au début** : si `day(start_date) > due_day`, le premier mois est sauté (première échéance le mois suivant).
- **À la fin** : tout mois **occupé au moins un jour reste dû** — condition `period_start ≤ end_date`. Pas de prorata automatique en v1.
- Le **dernier mois reste dû même si `due_date` tombe après `end_date`** (ex. bail finit le 3, `due_day = 5` → mois dû, `due_date` reste le 5).
- Ce n'est **pas un bug**, c'est une règle produit MVP explicite.

## Invariants base (durs)

1. `period_end ≥ period_start` (existant).
2. `due_date ≥ period_start` **et** `due_date ≤ period_end` (nouveau CHECK). `due_date` reste toujours dans le mois de `period_start`, même si elle dépasse `end_date`.
3. `period_start ≥ date_trunc('month', lease.start_date)` — échéance jamais avant le début du bail. Trigger (cross-table).
4. Unicité `(lease_id, period_start)` — déjà garantie par l'index unique `rent_dues_lease_id_period_start_key`.
5. Échéance liée à un paiement alloué → **non réécrite/supprimée** (voir [ADR-005] et protection financière ci-dessous).

## Protection financière (ciblée, pas large)

Principe : **on ne réécrit pas une échéance financière déjà liée à un paiement.**

- **Bloqués** si l'échéance a des allocations de paiement : changement de `lease_id`, `period_start`, `period_end`, `due_date`, `amount_due`, et la **suppression**.
- **Autorisés** : `updated_at`, note interne, transitions de `status` pilotées par le système (recompute), réversibles et non destructives.

## Conséquences

- Corriger `generate_rent_dues` : borne haute = `least(date_trunc('month', end_date), date_trunc('month', today))` quand `end_date` non null.
- CHECK `due_date` (invariant 2), trigger cross-table (invariant 3), trigger protection financière (ciblé).
- **Tests obligatoires avant merge** : les 6 cas + cas `end_date` (bail passé/futur) + cas spécifique `due_date > end_date` autorisé si même mois.
