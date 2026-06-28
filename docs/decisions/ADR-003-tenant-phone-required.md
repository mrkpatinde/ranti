# ADR-003 — Téléphone locataire obligatoire

## Statut

Accepté (CEO, 2026-06-28).

## Contexte

Ranti promet les relances de loyer. Une relance nécessite un canal joignable → le téléphone du locataire est indispensable. L'action serveur l'exige déjà, mais la base `tenants.phone` est encore `nullable`. Dérive code ↔ base.

## Décision

`tenants.phone` est **obligatoire** pour le MVP.

- Format **E.164** (ex. `+22997xxxxxxx`), validé côté code (et CHECK base optionnel).
- **Pas de valeur sentinelle** : on exige un numéro réel saisi, jamais un placeholder type `+00000000`.
- **Pas d'unicité globale** : deux locataires peuvent partager un numéro (cas réels : famille, intermédiaire). Aucune contrainte `UNIQUE` sur le téléphone.

## Conséquences

- Backfill requis pour les locataires existants sans téléphone **avant** la contrainte `NOT NULL` (corriger un par un, pas de remplissage automatique).
- Migration : `ALTER COLUMN phone SET NOT NULL` après backfill.
- Validation de format partagée côté action serveur ; CHECK base optionnel (`phone ~ '^\+[1-9][0-9]{6,14}$'`).
- Si des locataires existants n'ont pas de téléphone → la migration `NOT NULL` est **bloquée** tant que le backfill n'est pas fait. À traiter explicitement.
