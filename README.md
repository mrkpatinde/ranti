# Ranti

Ranti est le registre de loyer actif des propriétaires africains.

## Statut

Produit en reconstruction propre.

État actuel documenté : post-Sprint 6 — boucle propriétaire de base livrée côté produit/code, avec propriétés, logements, locataires, baux, échéances, encaissements et reçus/quittances.

Reminder Engine et Proof Engine sont cadrés dans les docs, mais leur implémentation complète doit passer par la gap analysis DB/code avant migration.

## Problème unique

Aider un propriétaire à savoir clairement :

1. qui a payé ;
2. qui est en retard ;
3. quelle preuve existe pour chaque paiement ;
4. quelle relance doit être préparée ou envoyée ;
5. quel reçu ou quelle quittance existe après validation.

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

Statut : cadré par ADR-006, gap analysis DB live réalisée, implémentation à planifier.

### Proof Engine

À partir d'un paiement validé par le propriétaire, Ranti génère automatiquement le document adapté : reçu partiel, reçu complet ou quittance.

Statut : cadré par ADR-007, DB live partiellement compatible (`receipts.kind`, `snapshot`), audit code requis avant modification.

## État livré post-Sprint 6

Livré ou partiellement livré :

- auth propriétaire ;
- profil propriétaire ;
- propriétés ;
- logements ;
- locataires ;
- baux ;
- activation / fin de bail ;
- génération des échéances ;
- encaissements ;
- allocations aux échéances ;
- reçus/quittances ;
- audit logs ;
- RLS activé.

À compléter :

- modifier / archiver propriétés, logements et locataires côté UI ;
- dashboard mensuel de synthèse ;
- Reminder Engine complet ;
- Proof Engine automatique complet ;
- ops runbook complet ;
- validation terrain documentée.

## Sources de vérité

Produit :

```txt
docs/vision.md
docs/principes.md
docs/personas.md
docs/user-flows.md
docs/research-log.md
```

Domaine et architecture :

```txt
docs/domain-model.md
docs/database.md
docs/api.md
docs/architecture.md
docs/decisions/
```

Implémentation et ops :

```txt
docs/roadmap.md
docs/implementation-plan-reminder-proof-engines.md
docs/gap-analysis-live-db-reminder-proof-engines.md
docs/ops-deployment.md
docs/docs-sync.md
```

Design :

```txt
docs/design-brief.md
docs/design/
```

## Règle de construction

Aucune fonctionnalité n'entre dans Ranti si elle ne rend pas plus simple le fait de savoir qui a payé, qui doit payer, quelle relance doit partir, ou quelle preuve doit exister après validation d'un paiement.
