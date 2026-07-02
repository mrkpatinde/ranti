# Ranti — Gap Analysis Live DB : Reminder Engine et Proof Engine

## Statut

Version 0.1 — constat après lecture du schéma live Supabase.

Date : 2026-06-29.

Projet Supabase : `pcxkxeesgusorrpmrkaj`.

## Objectif

Comparer la cible documentaire Reminder Engine / Proof Engine avec le schéma live Supabase.

Cette analyse ne modifie pas la base. Elle sert à préparer les migrations et éviter de coder sur une hypothèse fausse.

## Résumé exécutif

La DB live est fonctionnelle et déjà avancée pour le cycle de loyer actuel, mais elle n'est pas encore alignée avec la cible complète des deux moteurs.

Le Proof Engine existe partiellement : les reçus ont déjà `snapshot` et un champ `kind` avec `receipt` ou `quittance`.

Le Reminder Engine existe seulement sous forme embryonnaire : table `reminders` présente, mais pas de règles de rappel liées au bail.

## État live constaté

### Tables présentes

- `landlords`
- `properties`
- `units`
- `tenants`
- `leases`
- `rent_dues`
- `rent_receptions`
- `rent_reception_allocations`
- `payment_proofs`
- `receipts`
- `audit_logs`
- `reminders`

Toutes les tables métier listées sont en RLS activé.

### Données live constatées

- `landlords` : 1 row
- `properties` : 1 row
- `units` : 1 row
- `tenants` : 1 row
- `leases` : 1 row
- `rent_dues` : 1 row
- `rent_receptions` : 2 rows
- `receipts` : 2 rows
- `audit_logs` : 24 rows
- `reminders` : 0 row

## Gap table

| Sujet | Cible docs | État live | Écart | Action recommandée | Risque |
|---|---|---|---|---|---|
| `lease_reminder_rules` | table dédiée aux règles de rappel/relance liées au bail | absente | majeur | créer migration | moyen |
| `reminders` | relances générées depuis règles + échéances, statuts `draft/scheduled/queued/sent/failed/cancelled` | table existe, mais schéma ancien : `sms/whatsapp`, `sent/delivered/failed`, pas de `lease_id`, pas de `rule_id`, pas de `scheduled_for` | majeur | migration d'évolution | moyen |
| `rent_dues` | échéance centrale + relances calculées depuis règles | contient déjà `last_reminder_at`, `next_reminder_at`, `reminder_count` | partiel / ancien modèle | décider si conserver ou migrer vers `reminders` + `lease_reminder_rules` | moyen |
| `receipts.document_type` | `partial_payment_receipt`, `full_period_receipt`, `rent_quittance` | champ live `kind` avec `receipt` ou `quittance` | divergence de nommage et granularité | soit aligner docs sur `kind`, soit migrer vers type plus précis | élevé |
| `receipts.status` | `issued`, `cancelled`, `replaced` | `issued`, `cancelled` | `replaced` absent | ajouter si flux remplacement doit rester natif | moyen |
| `receipts` relation | document lié aux réceptions confirmées, possiblement multi-échéances | `rent_reception_id` unique dans `receipts` | modèle simple 1 réception -> 1 document | vérifier compatibilité avec paiements multi-mois / partiels | élevé |
| `rent_receptions.status` | `draft`, `pending_confirmation`, `confirmed`, `cancelled`, `reversed` | `draft`, `confirmed`, `cancelled` | statuts plus simples live | ne pas migrer sans besoin ; adapter docs ou ajouter statuts avec justification | moyen |
| `leases` | `rent_amount`, `billing_period`, `status suspended` | `monthly_rent_amount`, pas de `billing_period`, statuts `draft/active/ended/cancelled` | divergence doc/live | adapter docs ou prévoir migration légère | faible à moyen |
| Proof Engine automatique | confirmation paiement déclenche document adapté | à vérifier côté code ; DB support partiel | inconnu | audit server actions requis | élevé |
| Dashboard | relances + documents générés | à vérifier côté UI | inconnu | audit UI requis | moyen |

## Décisions à prendre avant migration

### Décision 1 — `document_type` vs `kind`

La DB live utilise déjà `receipts.kind` avec deux valeurs :

- `receipt`
- `quittance`

La documentation parle de `document_type` avec trois valeurs :

- `partial_payment_receipt`
- `full_period_receipt`
- `rent_quittance`

Décision recommandée : ne pas renommer brutalement sans besoin. Préférer une migration additive ou une clarification :

- garder `kind` pour l'UI simple ;
- ajouter éventuellement `settlement_scope` ou `document_type` plus tard si le besoin partiel/complet devient critique ;
- ou élargir `kind` avec prudence.

### Décision 2 — `reminders` ancien modèle vs nouveau modèle

La DB live a déjà `reminders`, mais elle représente surtout une trace d'envoi : canal, template, recipient, status, sent_at.

La cible produit a besoin d'un modèle plus riche : règle de bail, échéance, planification, file d'attente, historique.

Décision recommandée :

1. créer `lease_reminder_rules` ;
2. enrichir `reminders` sans perdre l'historique ;
3. ajouter `scheduled_for`, `lease_id`, `lease_reminder_rule_id`, `queued_at`, `failed_at` ;
4. élargir les statuts ;
5. garder `sent_at` comme trace d'envoi.

### Décision 3 — `rent_dues.last_reminder_at`, `next_reminder_at`, `reminder_count`

Ces champs existent déjà et semblent porter une logique de rappel directement dans l'échéance.

Décision recommandée : ne pas les supprimer immédiatement.

À court terme : les garder pour compatibilité.

À moyen terme : la source de vérité des relances devrait être `reminders`, pas des compteurs sur `rent_dues`.

### Décision 4 — Proof Engine automatique

La DB supporte déjà une partie du Proof Engine : `receipts.snapshot`, `kind`, `rent_reception_id` unique.

Mais il faut vérifier le code : confirmation de paiement génère-t-elle déjà automatiquement le reçu/quittance, ou faut-il encore une action manuelle ?

Décision recommandée : audit code avant migration.

## Prochain audit code obligatoire

Lire et comparer :

- actions de confirmation de réception ;
- génération de reçu/quittance ;
- annulation/remplacement de reçu ;
- génération d'échéances ;
- logique reminders existante ;
- dashboard monthly ;
- tests SQL/Vitest liés aux reçus et relances.

## Prompt Claude — audit code après DB live

```txt
Tu es Staff Engineer sur Ranti.

Contexte : le schéma live Supabase a été comparé aux docs Reminder Engine / Proof Engine. La DB live possède déjà `reminders`, `receipts.kind`, `receipts.snapshot`, `rent_dues.last_reminder_at`, `next_reminder_at`, `reminder_count`, mais elle ne possède pas `lease_reminder_rules`.

Mission : fais un audit code uniquement. Ne modifie aucun fichier.

À vérifier :
1. confirmation de paiement : génère-t-elle automatiquement un reçu/quittance ?
2. génération de reçu : est-elle manuelle, automatique ou fallback ?
3. `receipts.kind` est-il utilisé pour distinguer reçu/quittance ?
4. paiements partiels : que génère le code aujourd'hui ?
5. relances : la table `reminders` est-elle utilisée ?
6. les champs `last_reminder_at`, `next_reminder_at`, `reminder_count` sont-ils utilisés ?
7. dashboard : affiche-t-il relances et documents générés ?
8. tests : quels cas sont couverts ou manquants ?

Livrable :
- état actuel exact ;
- fichiers concernés ;
- écarts ;
- risques ;
- plan de migration/implémentation sans code.
```

## Verdict

La DB live n'est pas cassée. Elle est simplement en avance sur certains points et en retard sur d'autres.

Ne pas appliquer mécaniquement `docs/database.md` comme migration.

La prochaine bonne étape est un audit code ciblé, puis une migration additive minimale pour Reminder Engine et une clarification Proof Engine autour de `kind`, reçu partiel et quittance.
