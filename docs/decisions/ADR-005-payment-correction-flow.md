# ADR-005 — Flux de correction quittance / encaissement

## Statut

Accepté (CEO, 2026-06-28).

## Contexte

Un patch récent (action serveur TS) faisait : annuler une quittance → annuler **aussi** l'encaissement lié, en cascade automatique. La fonction SQL `cancel_receipt` est propre (elle annule le document seul), mais la cascade vit dans le code TS. Annuler une quittance ne veut pas dire que l'argent n'a jamais été reçu. Trois cas distincts sont aujourd'hui mélangés :

1. Document généré avec erreur, mais paiement réel reçu.
2. Paiement saisi par erreur → encaissement à retirer.
3. Quittance remplacée par une quittance corrigée.

## Décision

**On ne supprime pas l'histoire. On ajoute un événement correctif.**

Trois flux séparés, jamais fusionnés :

- **Annuler le document seul** — erreur de doc, paiement réel conservé. L'encaissement reste intact.
- **Annuler l'encaissement** — paiement saisi par erreur. Annule la réception (et le document lié) avec motif.
- **Remplacer le document** — une quittance corrigée remplace l'ancienne ; lien vers le remplaçant conservé.

Règles :

- Toute annulation **exige un motif** (déjà imposé au niveau SQL : `cancel_*` prennent `p_reason`).
- L'annulation est refusée si un reçu existe, **sauf** via ces flux explicites.
- Chaque flux écrit un `audit_logs` dans la même transaction (voir [ADR-006]).
- La **cascade automatique TS doit disparaître**.

## Conséquences

- Refactor de l'action serveur : supprimer la cascade automatique quittance→encaissement.
- UI : choix explicite du type de correction (3 options), jamais un seul bouton « annuler » ambigu.
- Aucune ligne financière n'est effacée : l'état correctif est ajouté, l'historique reste lisible.
