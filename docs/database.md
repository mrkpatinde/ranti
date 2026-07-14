# Ranti — Base de Données

## Statut

Version 1.4 — modèle relationnel candidat aligné avec l'architecture, les ADR-001, ADR-006, ADR-007 et l'API.

Ce document définit le modèle de référence de la base de données de Ranti avant migrations SQL définitives.

## Objectif

La base doit protéger la mémoire fiable des loyers et répondre clairement à cinq questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque loyer reçu, si une preuve existe ?
4. Quelle relance est prévue, préparée ou envoyée ?
5. Quel reçu ou quelle quittance a été généré après validation ?

## Principes

- Base relationnelle.
- `landlord_id` sur toutes les tables métier importantes.
- `rent_dues` est la table centrale du MVP.
- Une réception de loyer est indépendante d'un provider de paiement.
- Les rappels et relances naissent des règles du bail et des échéances.
- Les reçus et quittances naissent des paiements validés.
- Les données financières et historiques ne sont pas supprimées silencieusement.
- Les montants sont stockés en entiers, jamais en flottants.
- Les données dérivées comme `amount_received` et `balance_due` sont mises à jour uniquement par transaction serveur.

## Tables MVP immédiat

### `app_users`

Utilisateur applicatif connecté.

Champs : `id`, `auth_user_id`, `full_name`, `phone`, `email`, `status`, `created_at`, `updated_at`.

Contraintes : `auth_user_id` unique si possible ; `phone` peut devenir unique si le téléphone devient l'identifiant principal.

### `landlords`

Propriétaire ou espace propriétaire.

Champs : `id`, `owner_user_id`, `display_name`, `phone`, `country`, `city`, `default_currency`, `status`, `created_at`, `updated_at`, `deleted_at`.

Contraintes : `owner_user_id` référence `app_users.id` ; un utilisateur principal peut être limité à un seul propriétaire au MVP.

### `properties`

Propriété physique appartenant au propriétaire.

Champs : `id`, `landlord_id`, `name`, `address_text`, `city`, `country`, `status`, `created_at`, `updated_at`, `deleted_at`.

Contraintes : archiver une propriété ne supprime pas logements, baux ou échéances.

### `units`

Logement ou espace louable dans une propriété.

Champs : `id`, `landlord_id`, `property_id`, `name`, `unit_type`, `status`, `created_at`, `updated_at`, `deleted_at`.

Statuts : `available`, `occupied`, `inactive`, `archived`.

Contraintes : `landlord_id` doit correspondre à celui de la propriété ; un logement avec bail actif ne se supprime pas physiquement.

### `tenants`

Locataire connu du propriétaire.

Champs : `id`, `landlord_id`, `full_name`, `phone`, `email`, `notes`, `status`, `created_at`, `updated_at`, `deleted_at`.

Contraintes : pas d'unicité globale sur `phone` au MVP.

### `leases`

Bail ou accord locatif.

Champs : `id`, `landlord_id`, `property_id`, `unit_id`, `tenant_id`, `rent_amount`, `currency`, `billing_period`, `due_day`, `start_date`, `end_date`, `status`, `created_at`, `updated_at`, `deleted_at`.

Statuts : `draft`, `active`, `ended`, `suspended`, `cancelled`.

Contraintes :

- `rent_amount` > 0.
- `billing_period = monthly` au MVP.
- `due_day` entre 1 et 31 si utilisé.
- Un logement ne doit pas avoir deux baux actifs sur une période qui se chevauche.

Contrainte recommandée :

```txt
unique active lease per unit over overlapping period
```

Le SQL exact sera défini dans la migration finale.

### `lease_reminder_rules`

Règles de rappel et relance liées à un bail.

Cette table permet à Ranti de préparer ou automatiser les rappels/relances à partir du bail, sans demander au propriétaire de relancer manuellement chaque mois.

Champs : `id`, `landlord_id`, `lease_id`, `rule_type`, `offset_days`, `channel`, `message_template`, `is_active`, `created_at`, `updated_at`, `deleted_at`.

Types candidats :

- `before_due_reminder` : rappel avant échéance ;
- `due_day_reminder` : rappel le jour de l'échéance ;
- `after_due_reminder` : relance après retard.

Canaux : `whatsapp`, `sms`, `email`, `manual`.

Contraintes :

- Une règle appartient toujours à un bail du même propriétaire.
- Une règle inactive ne génère plus de nouvelles relances.
- Le message doit rester simple, clair et respectueux.
- Le canal externe est un adaptateur, jamais la source de vérité métier.

### `rent_dues`

Échéance de loyer. Table centrale du MVP.

Champs : `id`, `landlord_id`, `lease_id`, `property_id`, `unit_id`, `tenant_id`, `period_start`, `period_end`, `due_date`, `amount_due`, `currency`, `amount_received`, `balance_due`, `status`, `generated_from`, `created_at`, `updated_at`, `cancelled_at`, `deleted_at`.

Statuts visibles MVP :

- `expected` : échéance attendue, à venir ou déjà due mais pas encore en retard ;
- `overdue` : date limite dépassée et montant non réglé ;
- `paid` : montant attendu intégralement reçu ;
- `cancelled` : échéance annulée avec trace.

Le paiement partiel est calculé via les allocations, pas par un statut intermédiaire visible.

Contraintes :

- `amount_due`, `amount_received`, `balance_due` >= 0.
- `amount_received` est dérivé des allocations confirmées.
- Une même période ne doit pas être générée deux fois pour le même bail.

Contrainte recommandée : `unique(lease_id, period_start, period_end)`.

### `rent_receptions`

Réception de loyer confirmée ou à confirmer par le propriétaire.

Champs : `id`, `landlord_id`, `tenant_id`, `amount`, `currency`, `method`, `status`, `received_at`, `confirmed_at`, `confirmed_by_user_id`, `notes`, `created_at`, `updated_at`, `cancelled_at`, `deleted_at`.

Méthodes : `cash`, `mobile_money`, `bank_transfer`, `manual`, `online_payment`, `other`.

Statuts : `draft`, `pending_confirmation`, `confirmed`, `cancelled`, `reversed`.

Contraintes : `amount` > 0 ; une réception confirmée ne se supprime pas physiquement ; confirmation humaine MVP obligatoire.

### `rent_reception_allocations`

Relie une réception de loyer à une ou plusieurs échéances.

Champs : `id`, `landlord_id`, `rent_reception_id`, `rent_due_id`, `amount_allocated`, `created_at`, `updated_at`.

Contraintes :

- `amount_allocated` > 0.
- La somme des allocations d'une réception ne dépasse pas le montant reçu.
- La somme des allocations confirmées d'une échéance détermine `amount_received`.

### `payment_proofs`

Preuve facultative de paiement ou de réception de loyer.

Champs : `id`, `landlord_id`, `rent_reception_id`, `rent_due_id`, `uploaded_by_user_id`, `uploaded_by_role`, `file_url`, `file_name`, `mime_type`, `file_size_bytes`, `status`, `created_at`, `updated_at`, `deleted_at`.

Contraintes :

- Une preuve est liée d'abord à une réception de loyer.
- Une preuve liée uniquement à une échéance est autorisée seulement dans un cas contrôlé et explicite.
- Une preuve ne doit jamais être un fichier isolé sans contexte métier.
- Les fichiers doivent être protégés par permissions.

### `receipts`

Quittance ou reçu généré par Ranti.

Champs : `id`, `landlord_id`, `tenant_id`, `lease_id`, `unit_id`, `receipt_number`, `document_type`, `currency`, `total_amount`, `issued_at`, `issued_by_user_id`, `status`, `pdf_file_url`, `snapshot`, `created_at`, `updated_at`, `cancelled_at`.

Types candidats :

- `partial_payment_receipt` : reçu de paiement partiel ;
- `full_period_receipt` : reçu complet d'une période soldée ;
- `rent_quittance` : quittance de loyer.

Statuts : `issued`, `cancelled`, `replaced`.

Contraintes :

- `receipt_number` unique par propriétaire.
- Un reçu doit être lié à des réceptions de loyer confirmées.
- Un reçu ou une quittance est généré automatiquement après validation propriétaire quand les conditions sont réunies.
- Un reçu généré ne se modifie pas silencieusement.
- `snapshot` conserve les informations importantes au moment de génération.

### `receipt_items`

Relie un reçu aux échéances et réceptions de loyer couvertes.

Champs : `id`, `landlord_id`, `receipt_id`, `rent_due_id`, `rent_reception_id`, `amount`, `period_start`, `period_end`, `created_at`.

Contraintes : `amount` > 0.

### `reminders`

Rappel ou relance liée à une échéance.

MVP prudent : Ranti prépare automatiquement les rappels/relances à partir des règles du bail ; l'envoi externe complet peut rester validé ou déclenché par le propriétaire selon les contraintes WhatsApp/SMS.

Champs : `id`, `landlord_id`, `lease_id`, `rent_due_id`, `tenant_id`, `lease_reminder_rule_id`, `channel`, `message`, `status`, `scheduled_for`, `queued_at`, `sent_at`, `failed_at`, `created_by`, `created_at`, `updated_at`.

Canaux : `manual`, `whatsapp`, `sms`, `email`.

Statuts : `draft`, `scheduled`, `queued`, `sent`, `failed`, `cancelled`.

Contraintes :

- Une relance doit toujours viser une échéance.
- Une relance peut être générée depuis une règle de bail.
- Le canal ne devient jamais source de vérité.
- Une relance ne modifie jamais le statut de paiement.

### `audit_logs`

Trace les actions sensibles.

Champs : `id`, `landlord_id`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `metadata`, `created_at`.

Contraintes : append-only autant que possible ; pas de modification par flux utilisateur standard ; pas de données sensibles inutiles en clair.

### `payment_transactions` (ADR-018 v3, live)

Ledger du rail PSP : une ligne par notification de paiement, jamais droppée
(un montant inattendu est enregistré `rejected` avec raison). Le locataire
paie exactement le loyer ; 3,0 % sont prélevés sur le brut (frais PSP +
commission Ranti), le net (97 %) est reversé au propriétaire via l'API payout
du PSP. Les fonds vivent dans le wallet marchand chez le PSP agréé (reco :
FedaPay — comparatif dans ADR-018).

Champs : `id`, `landlord_id`, `lease_id`, `provider`
(`fedapay`/`feexpay`/`kkiapay`), `provider_reference` (unique par provider —
clé d'idempotence), `amount_received` (brut, FCFA entier), `psp_fee_bp`
(défaut 180) et `platform_fee_bp` (défaut 120) — taux en basis points stockés
sur la ligne, `psp_fee`, `platform_fee`, `net_amount` (reversé au
propriétaire), `currency` (`XOF`), `status`
(`pending`/`verified`/`paid_out`/`rejected`), `rejection_reason`,
`rent_reception_id`, `payload`, `created_at`, `verified_at`, `paid_out_at`.

Machine à états : `pending` (webhook ingéré) → `verified` (**validation du
propriétaire** — déclenche réception + quittance) → `paid_out` (net reversé,
ops) ; `rejected` terminal depuis `pending`. Aucun retour en arrière.

Contraintes : CHECKs arithmétiques (`fee = floor(montant × bp / 10000)` par
composant, `net = montant − psp_fee − platform_fee` — la ligne balance par
construction) ;
`verified`/`paid_out` ⇒ `rent_reception_id` non nul ; `paid_out` ⇔
`paid_out_at` non nul. Écritures uniquement via RPC SECURITY DEFINER :
`ingest_payment_notification` / `reject_payment_transaction` /
`mark_payment_transaction_paid_out` = `service_role` seul ;
`verify_payment_transaction` = `authenticated` avec garde d'appartenance
(`landlord_id = private.current_landlord_id()`). `authenticated` = SELECT seul
sous RLS. La validation passe par le pipeline existant
`record_collection_core → confirm_collection_core → generate_receipt_core`
(aucune voie d'écriture parallèle, ADR-017) avec `recorded_by = 'psp'` et la
référence PSP en `payment_reference` (déduplication cross-rail avec le
collage SMS). `record_collection_core` n'a qu'une seule signature (11 args,
`p_reference default null`) : la surcharge 10 args héritée de
20260703230000 est supprimée par 20260714120000 — sa coexistence rendait
ambigus tous les appels à 10 arguments (wrapper legacy `record_collection`
7 args, `ops_record_collection`).

Note de dérive : en live, `rent_receptions.recorded_by` accepte
`('landlord', 'operator', 'tenant', 'psp')` — ce document décrivait
initialement un modèle antérieur.

## Tables Post-MVP

### `notification_deliveries`

Trace les tentatives d'envoi via WhatsApp, SMS ou email. Nécessaire seulement quand Ranti envoie réellement via un prestataire.

### `public_links`

Liens partageables contrôlés pour reçu, preuve, relance ou action locataire sans compte complet.

Post-MVP sauf besoin terrain urgent.

Contraintes futures : token brut jamais stocké ; expiration/révocation ; accès limité au but du lien.

## Relations principales

```txt
app_users -> landlords
landlords -> properties -> units -> leases -> rent_dues
leases -> lease_reminder_rules -> reminders
landlords -> tenants -> leases
rent_dues -> rent_reception_allocations -> rent_receptions
rent_receptions -> payment_proofs
rent_dues -> reminders
receipts -> receipt_items -> rent_dues / rent_receptions
landlords -> audit_logs
```

## Règles d'intégrité métier

1. Tout objet métier appartient à un propriétaire.
2. Un bail relie un logement et un locataire.
3. Un logement ne peut pas avoir deux baux actifs sur une période qui se chevauche.
4. Une échéance vient d'un bail.
5. Une règle de rappel/relance vient d'un bail.
6. Une relance vise toujours une échéance.
7. Une réception de loyer confirmée doit être allouée à une ou plusieurs échéances.
8. Un reçu ou une quittance vient après confirmation d'une réception de loyer.
9. Un reçu ou une quittance généré ne se modifie pas silencieusement.
10. Les fichiers sensibles sont protégés.
11. Les actions critiques sont auditées.

## Index recommandés

```txt
app_users(auth_user_id)
landlords(owner_user_id)
properties(landlord_id)
units(landlord_id, property_id)
tenants(landlord_id)
leases(landlord_id, unit_id, status)
leases(landlord_id, tenant_id, status)
lease_reminder_rules(landlord_id, lease_id, is_active)
rent_dues(landlord_id, status, due_date)
rent_dues(landlord_id, tenant_id, due_date)
rent_dues(lease_id, period_start, period_end)
rent_receptions(landlord_id, tenant_id, received_at)
rent_reception_allocations(rent_reception_id)
rent_reception_allocations(rent_due_id)
payment_proofs(landlord_id, rent_due_id)
payment_proofs(landlord_id, rent_reception_id)
receipts(landlord_id, receipt_number)
receipts(landlord_id, tenant_id, issued_at)
receipt_items(receipt_id)
reminders(landlord_id, rent_due_id, scheduled_for)
reminders(landlord_id, lease_reminder_rule_id, status)
audit_logs(landlord_id, entity_type, entity_id)
audit_logs(actor_user_id, created_at)
```

## Sécurité et accès

- Un propriétaire ne voit que les données de son `landlord_id`.
- Cette règle doit être appliquée côté serveur et, si possible, via politiques de sécurité base.
- Le locataire n'a pas d'espace complet par défaut au MVP.
- L'accès administrateur est limité, tracé et réservé au support ou à la sécurité.

## Suppression et archivage

Suppression physique acceptable pour brouillons sans impact, données créées par erreur avant activation, événements techniques non critiques après rétention.

Suppression physique à éviter pour baux, règles de rappel, échéances, réceptions de loyer, allocations, preuves, reçus, relances envoyées, audit logs.

Préférer `archived`, `cancelled`, `reversed`, `deleted_at` avec audit, ou une correction.

## Exclu du MVP

- Agences complexes.
- Multi-propriétaires avancés.
- Équipes et rôles granulaires.
- Portail locataire complet.
- Liens publics contrôlés.
- Envoi automatique externe non maîtrisé.
- Comptabilité complète.
- Paiements en ligne obligatoires.
- Rapprochement bancaire automatique.
- Analytics avancés.

## Questions ouvertes avant migrations SQL

1. Prestataire d'authentification initial.
2. Format exact de l'identifiant utilisateur.
3. Politique de stockage des preuves.
4. Format du numéro de reçu.
5. Stratégie exacte de génération des échéances.
6. Stratégie de correction d'un reçu déjà généré.
7. SQL exact pour empêcher les baux actifs qui se chevauchent sur un même logement.
8. Stratégie exacte de génération des règles et relances.
9. Statut exact à utiliser pour reçu partiel, reçu complet et quittance.

## Ordre recommandé des migrations

1. `app_users`
2. `landlords`
3. `properties`
4. `units`
5. `tenants`
6. `leases`
7. `lease_reminder_rules`
8. `rent_dues`
9. `rent_receptions`
10. `rent_reception_allocations`
11. `payment_proofs`
12. `receipts`
13. `receipt_items`
14. `reminders`
15. `audit_logs`

Post-MVP : `notification_deliveries`, `public_links`.

## Phrase de contrôle

La base de données de Ranti doit pouvoir raconter l'histoire suivante sans ambiguïté :

> Ce propriétaire a ce logement. Ce locataire l'occupe selon ce bail. Pour ce mois, cette échéance était attendue. Voici ce qui a été reçu. Voici la preuve s'il y en a une. Voici le reçu ou la quittance généré. Voici la relance prévue ou envoyée. Voici l'historique des actions.

Si le schéma ne permet plus de raconter cette histoire simplement, il doit être corrigé.
