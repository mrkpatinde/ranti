# Ranti

Ranti est le registre de loyer actif des propriétaires africains.

## Statut

Reconstruction propre depuis zéro.

Ce dépôt est la source de vérité produit et technique de Ranti.

## Problème unique

Aider un propriétaire à savoir clairement :

1. qui a payé ;
2. qui est en retard ;
3. quelle preuve existe pour chaque paiement ;
4. quelle relance ou preuve Ranti doit préparer automatiquement.

## Boucle produit

Ranti suit une boucle simple :

1. le propriétaire renseigne le bail ;
2. Ranti génère les échéances ;
3. Ranti prépare ou automatise les rappels et relances ;
4. le propriétaire valide les paiements reçus ;
5. Ranti génère automatiquement le reçu ou la quittance adapté ;
6. Ranti conserve l'historique et les preuves.

## Deux moteurs produit

### Reminder Engine

À partir du bail et des échéances, Ranti prépare, planifie ou envoie les rappels et relances.

### Proof Engine

À partir d'un paiement validé par le propriétaire, Ranti génère automatiquement le document adapté : reçu partiel ou quittance complète.

## Règle de construction

Aucune fonctionnalité n'entre dans Ranti si elle ne rend pas plus simple le fait de savoir qui a payé, qui doit payer, quelle relance doit partir, ou quelle preuve doit exister après validation d'un paiement.

## Structure initiale

```txt
docs/
  vision.md
  principes.md
  personas.md
  domain-model.md
  user-flows.md
  design-brief.md
  database.md
  api.md
  roadmap.md
  decisions/
```
