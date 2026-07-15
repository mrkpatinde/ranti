# Ranti

Ranti est le registre de loyer actif des propriétaires africains.

## Statut

La boucle propriétaire est livrée de bout en bout : propriétés, logements, locataires, baux, génération des échéances, encaissements avec allocations, reçus/quittances, audit logs.

Les relances sont automatiques à partir des échéances : cron quotidien (`/api/cron/reminders`, planifié par `apps/web/vercel.json`), templates SMS, confirmation locataire par lien public à token (`/confirmer/[token]`). Le locataire ne crée pas de compte : il déclare avoir payé, le propriétaire valide.

Ranti ne détient jamais les fonds. Par défaut, l'argent circule directement entre le locataire et le propriétaire (cash, Mobile Money, virement) et le propriétaire valide les paiements reçus hors Ranti. L'encaissement optionnel via le partenaire de paiement agréé (ADR-018, commission 5 % tout compris, 95 % reversés) est codé mais non activé en production tant que la validation juridique BCEAO n'est pas obtenue (2026-07-15).

Limites actuelles :

- l'envoi SMS réel n'est pas encore validé en production tant que le provider n'est pas configuré (sandbox : les SMS sont journalisés) ;
- WhatsApp n'est pas implémenté (colonne `channel` prévue, SMS d'abord).

Détail opérationnel : `docs/BUILD_STATUS.md`.

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

À partir du bail et des échéances, Ranti prépare, planifie et envoie les rappels et relances, automatiquement.

Statut : implémenté (cron `/api/cron/reminders`, fenêtres J-5/J-1/retard, table `reminders`, confirmation locataire par token). Envoi SMS réel en attente de configuration du provider en production.

### Proof Engine

À partir d'un paiement validé par le propriétaire, Ranti génère automatiquement le document adapté : reçu partiel, reçu complet ou quittance.

Statut : implémenté (`generate_receipt`, `receipts.kind`, `snapshot`, numérotation atomique, correction par remplacement). Aucun document n'est généré sans allocation financière réelle.

## État livré

Livré :

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
- RLS activé ;
- dashboard mensuel de synthèse ;
- relances automatiques (cron + SMS sandbox) ;
- confirmation locataire par lien public ;
- vérification publique des quittances (`/verifier/[id]`, exemple statique `/verifier/demo`).

À compléter :

- modifier / archiver propriétés, logements et locataires côté UI ;
- envoi SMS réel (provider à configurer en production) ;
- WhatsApp ;
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
