# Ranti — Base de Données

## Statut

Version 1.1 — schéma relationnel candidat pour le MVP.

Ce document définit le premier modèle de base de données de Ranti.

Il ne s'agit pas encore d'une migration SQL définitive. Il s'agit d'un modèle de référence pour valider les tables, les relations, les contraintes, les statuts et les règles d'intégrité avant implémentation.

## Objectif

La base de données de Ranti doit protéger la mémoire fiable des loyers.

Elle doit permettre de répondre clairement à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque paiement ?

Le schéma doit rester simple, relationnel, sécurisé et fidèle au domaine métier.

## Principes de conception

### 1. Base relationnelle

Ranti doit utiliser une base de données relationnelle.

Le domaine contient des relations fortes : propriétaire, propriété, logement, locataire, bail, échéance, encaissement, preuve, reçu, relance.

Ces relations doivent être protégées par des clés étrangères, des contraintes et des transactions.

### 2. Séparation stricte par propriétaire

Toutes les tables métier importantes doivent contenir `landlord_id`.

Cela permet :

- d'isoler les données ;
- de simplifier les permissions ;
- de faciliter les requêtes ;
- de préparer les politiques de sécurité ;
- d'éviter les accès croisés entre propriétaires.

Même si certaines relations permettent de retrouver le propriétaire indirectement, `landlord_id` doit rester présent sur les objets métier critiques.

### 3. L'échéance de loyer est centrale

La table `rent_dues` est centrale dans le MVP.

Elle représente l'obligation de paiement attendue pour une période donnée.

Les encaissements, preuves, reçus et relances doivent pouvoir être reliés à une échéance.

### 4. Encaissement différent du paiement provider

Ranti enregistre d'abord ce que le propriétaire a encaissé.

Un encaissement peut venir de :

- cash ;
- Mobile Money ;
- virement ;
- autre moyen local ;
- paiement en ligne futur.

La base ne doit pas dépendre d'un prestataire de paiement.

### 5. Historique avant suppression

Les données critiques ne doivent pas être supprimées silencieusement.

Les tables critiques doivent prévoir :

- `created_at` ;
- `updated_at` ;
- `deleted_at` si la suppression logique est utile ;
- un audit log pour les actions sensibles.

### 6. États explicites

Les statuts doivent être explicites.

Éviter les booléens ambigus comme `is_paid`, `is_late`, `is_validated`.

Préférer des statuts métier contrôlés : `upcoming`, `due`, `overdue`, `confirmed`, `cancelled`, etc.

### 7. Argent en entiers

Les montants doivent être stockés en entiers mineurs.

Pour le FCFA, cela revient généralement au montant entier en francs.

Exemple : `50000` pour 50 000 FCFA.

Éviter les flottants pour l'argent.

### 8. Données dérivées contrôlées

Certaines données peuvent être stockées pour simplifier les affichages, par exemple `amount_collected` ou `balance_due` sur une échéance.

Mais la source de vérité reste l'ensemble des encaissements et allocations reliés à l'échéance.

Si une donnée dérivée est stockée, elle doit être mise à jour uniquement par le serveur ou par une transaction contrôlée.

## Conventions techniques

Les tables utilisent l'anglais simple, au pluriel.

Chaque table principale utilise `id` comme identifiant primaire, idéalement en UUID.

Les dates techniques utilisent `timestamptz`.

Les dates métier simples utilisent `date`.

Chaque montant financier doit être associé à une devise via `currency`.

Valeur initiale probable : `XOF`.

## Tables du MVP

## 1. `app_users`

Représente l'utilisateur applicatif connecté.

Cette table complète le service d'authentification.

Champs candidats :

- `id`
- `auth_user_id`
- `full_name`
- `phone`
- `email`
- `status`
- `created_at`
- `updated_at`

Contraintes :

- `auth_user_id` doit être unique si le prestataire d'authentification le permet.
- `phone` peut devenir unique si le téléphone devient l'identifiant principal.
- Un utilisateur désactivé ne doit pas pouvoir agir sur les données métier.

## 2. `landlords`

Représente le propriétaire ou l'espace propriétaire.

Dans le MVP, un utilisateur principal correspond généralement à un propriétaire.

Champs candidats :

- `id`
- `owner_user_id`
- `display_name`
- `phone`
- `country`
- `city`
- `default_currency`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Contraintes :

- `owner_user_id` référence `app_users.id`.
- Pour le MVP, un `owner_user_id` peut être limité à un seul `landlord`.
- Toutes les données métier doivent être rattachées à `landlords.id`.

## 3. `properties`

Représente une propriété physique appartenant au propriétaire.

Une propriété peut contenir un ou plusieurs logements.

Champs candidats :

- `id`
- `landlord_id`
- `name`
- `address_text`
- `city`
- `country`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Contraintes :

- `landlord_id` référence `landlords.id`.
- Une propriété archivée ne doit pas supprimer ses logements, baux ou échéances.

## 4. `units`

Représente un logement ou espace louable situé dans une propriété.

Champs candidats :

- `id`
- `landlord_id`
- `property_id`
- `name`
- `unit_type`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Statuts candidats :

- `available`
- `occupied`
- `inactive`
- `archived`

Contraintes :

- `landlord_id` référence `landlords.id`.
- `property_id` référence `properties.id`.
- Le `landlord_id` du logement doit correspondre au `landlord_id` de la propriété.
- Un logement avec un bail actif ne doit pas être supprimé physiquement.

## 5. `tenants`

Représente un locataire connu du propriétaire.

Le locataire est secondaire dans le MVP, mais il doit être correctement représenté pour éviter les conflits.

Champs candidats :

- `id`
- `landlord_id`
- `full_name`
- `phone`
- `email`
- `notes`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Contraintes :

- `landlord_id` référence `landlords.id`.
- Le même numéro de téléphone peut exister chez plusieurs propriétaires.
- Ne pas imposer une unicité globale sur `phone` au niveau MVP.

## 6. `leases`

Représente le bail ou accord locatif.

Le bail définit les règles de génération des échéances.

Il ne doit pas être confondu avec un contrat PDF ou papier.

Champs candidats :

- `id`
- `landlord_id`
- `property_id`
- `unit_id`
- `tenant_id`
- `rent_amount`
- `currency`
- `billing_period`
- `due_day`
- `start_date`
- `end_date`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Statuts candidats :

- `draft`
- `active`
- `ended`
- `suspended`
- `cancelled`

Contraintes :

- `landlord_id` référence `landlords.id`.
- `property_id` référence `properties.id`.
- `unit_id` référence `units.id`.
- `tenant_id` référence `tenants.id`.
- Les `landlord_id` de la propriété, du logement et du locataire doivent correspondre.
- Un logement ne devrait pas avoir deux baux actifs sur la même période.
- `rent_amount` doit être supérieur à zéro.
- `billing_period` est limité à `monthly` au MVP, sauf décision documentée.
- `due_day` doit être compris entre 1 et 31 si utilisé.

## 7. `rent_dues`

Représente une échéance de loyer.

C'est la table centrale du MVP.

Une échéance existe même si le paiement n'a pas encore été effectué.

Champs candidats :

- `id`
- `landlord_id`
- `lease_id`
- `property_id`
- `unit_id`
- `tenant_id`
- `period_start`
- `period_end`
- `due_date`
- `amount_due`
- `currency`
- `amount_collected`
- `balance_due`
- `status`
- `generated_from`
- `created_at`
- `updated_at`
- `cancelled_at`
- `deleted_at`

Statuts candidats :

- `upcoming`
- `due`
- `partially_collected`
- `collected`
- `overdue`
- `cancelled`
- `disputed`

Contraintes :

- `landlord_id` référence `landlords.id`.
- `lease_id` référence `leases.id`.
- `unit_id`, `tenant_id` et `property_id` doivent correspondre au bail.
- `amount_due` doit être supérieur ou égal à zéro.
- `amount_collected` doit être supérieur ou égal à zéro.
- `balance_due` doit être supérieur ou égal à zéro.
- Une même période ne doit pas être générée deux fois pour le même bail.

Contrainte recommandée :

```txt
unique(lease_id, period_start, period_end)
```

## 8. `collections`

Représente un encaissement du point de vue du propriétaire.

Un encaissement peut régler une ou plusieurs échéances.

Une échéance peut recevoir plusieurs encaissements.

Champs candidats :

- `id`
- `landlord_id`
- `tenant_id`
- `amount`
- `currency`
- `method`
- `status`
- `collected_at`
- `confirmed_at`
- `confirmed_by_user_id`
- `notes`
- `created_at`
- `updated_at`
- `cancelled_at`
- `deleted_at`

Méthodes candidates :

- `cash`
- `mobile_money`
- `bank_transfer`
- `manual`
- `online_payment`
- `other`

Statuts candidats :

- `draft`
- `pending_confirmation`
- `confirmed`
- `cancelled`
- `reversed`

Contraintes :

- `amount` doit être supérieur à zéro.
- Un encaissement confirmé ne doit pas être supprimé physiquement.
- Une annulation ou correction doit être auditée.
- La confirmation MVP reste humaine côté propriétaire.

## 9. `collection_allocations`

Relie un encaissement à une ou plusieurs échéances.

Cette table est nécessaire pour gérer correctement :

- paiement partiel ;
- paiement en retard ;
- paiement couvrant plusieurs mois ;
- plusieurs paiements pour un même mois.

Champs candidats :

- `id`
- `landlord_id`
- `collection_id`
- `rent_due_id`
- `amount_allocated`
- `created_at`
- `updated_at`

Contraintes :

- `collection_id` référence `collections.id`.
- `rent_due_id` référence `rent_dues.id`.
- `landlord_id` doit correspondre sur les deux côtés.
- `amount_allocated` doit être supérieur à zéro.
- La somme des allocations d'un encaissement ne doit pas dépasser le montant de l'encaissement.
- La somme des allocations confirmées sur une échéance détermine son montant encaissé.

## 10. `payment_proofs`

Représente une preuve de paiement ou d'encaissement.

Une preuve peut être liée à un encaissement, une échéance, ou les deux selon le moment où elle est ajoutée.

Champs candidats :

- `id`
- `landlord_id`
- `collection_id`
- `rent_due_id`
- `uploaded_by_user_id`
- `uploaded_by_role`
- `file_url`
- `file_name`
- `mime_type`
- `file_size_bytes`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Contraintes :

- Une preuve doit être reliée au minimum à une échéance ou un encaissement.
- Les fichiers doivent être protégés par des permissions.
- Une preuve rejetée ou archivée ne doit pas disparaître si elle a servi dans un conflit.

## 11. `receipts`

Représente une quittance ou un reçu généré par Ranti.

Un reçu doit être déterministe et généré à partir de données confirmées.

Champs candidats :

- `id`
- `landlord_id`
- `tenant_id`
- `lease_id`
- `unit_id`
- `receipt_number`
- `currency`
- `total_amount`
- `issued_at`
- `issued_by_user_id`
- `status`
- `pdf_file_url`
- `snapshot`
- `created_at`
- `updated_at`
- `cancelled_at`

Statuts candidats :

- `issued`
- `cancelled`
- `replaced`

Contraintes :

- `receipt_number` doit être unique par propriétaire.
- Un reçu doit être lié à des encaissements confirmés.
- Un reçu généré ne doit pas être modifié silencieusement.
- Les informations importantes doivent être conservées dans `snapshot` pour garder la trace même si le locataire ou le logement change plus tard.

Contrainte recommandée :

```txt
unique(landlord_id, receipt_number)
```

## 12. `receipt_items`

Relie un reçu aux échéances et encaissements qu'il couvre.

Cette table évite de perdre la précision lorsque :

- un reçu couvre plusieurs mois ;
- un encaissement couvre plusieurs échéances ;
- plusieurs encaissements règlent une même échéance.

Champs candidats :

- `id`
- `landlord_id`
- `receipt_id`
- `rent_due_id`
- `collection_id`
- `amount`
- `period_start`
- `period_end`
- `created_at`

Contraintes :

- `receipt_id` référence `receipts.id`.
- `rent_due_id` référence `rent_dues.id`.
- `collection_id` référence `collections.id` si présent.
- `amount` doit être supérieur à zéro.

## 13. `reminders`

Représente une relance liée à une échéance.

La relance existe dans Ranti même si l'envoi externe échoue.

Champs candidats :

- `id`
- `landlord_id`
- `rent_due_id`
- `tenant_id`
- `channel`
- `message`
- `status`
- `sent_at`
- `created_by_user_id`
- `created_at`
- `updated_at`

Canaux candidats :

- `whatsapp`
- `sms`
- `email`
- `manual`

Statuts candidats :

- `draft`
- `queued`
- `sent`
- `failed`
- `cancelled`

Contraintes :

- Une relance doit être liée à une échéance.
- Le canal ne doit pas devenir la source de vérité.
- Une relance envoyée doit rester visible dans l'historique.

## 14. `notification_deliveries`

Trace les tentatives d'envoi via les canaux externes.

Cette table est technique.

Elle ne remplace pas `reminders`.

Champs candidats :

- `id`
- `landlord_id`
- `reminder_id`
- `channel`
- `recipient`
- `provider`
- `provider_message_id`
- `status`
- `error_message`
- `sent_at`
- `delivered_at`
- `created_at`
- `updated_at`

Contraintes :

- Ne pas stocker plus de données personnelles que nécessaire.
- Les erreurs doivent aider au diagnostic sans exposer inutilement des données sensibles.

## 15. `audit_logs`

Trace les actions sensibles.

Cette table protège la confiance dans Ranti.

Champs candidats :

- `id`
- `landlord_id`
- `actor_user_id`
- `actor_role`
- `action`
- `entity_type`
- `entity_id`
- `before_data`
- `after_data`
- `metadata`
- `created_at`

Actions candidates :

- `landlord.created`
- `property.created`
- `property.updated`
- `unit.created`
- `unit.updated`
- `tenant.created`
- `tenant.updated`
- `lease.created`
- `lease.activated`
- `lease.ended`
- `rent_due.generated`
- `rent_due.status_changed`
- `collection.created`
- `collection.confirmed`
- `collection.cancelled`
- `payment_proof.added`
- `payment_proof.archived`
- `receipt.generated`
- `receipt.cancelled`
- `reminder.created`
- `reminder.sent`

Contraintes :

- Les logs d'audit doivent être append-only autant que possible.
- Ils ne doivent pas être modifiés par des flux utilisateur standards.
- Ils ne doivent pas contenir inutilement des fichiers ou données très sensibles en clair.

## 16. `public_links`

Représente les liens partageables contrôlés.

Ces liens peuvent servir à :

- ouvrir un reçu ;
- transmettre une preuve ;
- consulter une relance ;
- permettre une action locataire sans compte complet.

Champs candidats :

- `id`
- `landlord_id`
- `token_hash`
- `purpose`
- `entity_type`
- `entity_id`
- `expires_at`
- `revoked_at`
- `created_at`
- `last_used_at`

Contraintes :

- Le token brut ne doit pas être stocké.
- Le lien doit pouvoir expirer ou être révoqué.
- Le lien ne doit donner accès qu'à l'action prévue.

## Relations principales

```txt
app_users
  -> landlords

landlords
  -> properties
  -> units
  -> tenants
  -> leases
  -> rent_dues
  -> collections
  -> payment_proofs
  -> receipts
  -> reminders
  -> audit_logs

properties
  -> units

units
  -> leases

tenants
  -> leases

leases
  -> rent_dues

rent_dues
  -> collection_allocations
  -> reminders
  -> receipt_items
  -> payment_proofs

collections
  -> collection_allocations
  -> payment_proofs
  -> receipt_items

receipts
  -> receipt_items

reminders
  -> notification_deliveries
```

## Règles d'intégrité métier

### Règle 1 — Tout objet métier appartient à un propriétaire

Chaque propriété, logement, locataire, bail, échéance, encaissement, preuve, reçu et relance doit appartenir à un `landlord_id`.

### Règle 2 — Un bail relie un logement et un locataire

Un bail actif doit toujours relier :

- un propriétaire ;
- une propriété ;
- un logement ;
- un locataire ;
- des règles de loyer.

### Règle 3 — Une échéance vient d'un bail

Une échéance doit être générée à partir d'un bail actif, sauf décision future sur les échéances exceptionnelles.

### Règle 4 — Un encaissement doit être affecté

Un encaissement confirmé doit être affecté à une ou plusieurs échéances via `collection_allocations`.

### Règle 5 — Un reçu vient après confirmation

Un reçu ne peut être généré que sur la base d'un encaissement confirmé ou d'une échéance réglée.

### Règle 6 — Une relance doit viser une échéance

Une relance doit toujours être reliée à une échéance.

### Règle 7 — Les fichiers sensibles sont protégés

Les preuves, reçus et contrats éventuels ne doivent pas être exposés publiquement sans lien contrôlé.

### Règle 8 — Les actions critiques sont auditées

Toute action qui modifie un bail, une échéance, un encaissement, une preuve, un reçu ou une relance doit créer une trace dans `audit_logs`.

## Index recommandés

Index minimum recommandés :

```txt
app_users(auth_user_id)
landlords(owner_user_id)
properties(landlord_id)
units(landlord_id, property_id)
tenants(landlord_id)
leases(landlord_id, unit_id, status)
leases(landlord_id, tenant_id, status)
rent_dues(landlord_id, status, due_date)
rent_dues(landlord_id, tenant_id, due_date)
rent_dues(lease_id, period_start, period_end)
collections(landlord_id, tenant_id, collected_at)
collection_allocations(collection_id)
collection_allocations(rent_due_id)
payment_proofs(landlord_id, rent_due_id)
payment_proofs(landlord_id, collection_id)
receipts(landlord_id, receipt_number)
receipt_items(receipt_id)
reminders(landlord_id, rent_due_id, created_at)
notification_deliveries(landlord_id, reminder_id)
audit_logs(landlord_id, entity_type, entity_id)
audit_logs(actor_user_id, created_at)
public_links(token_hash)
```

## Sécurité et accès

### Règle d'accès propriétaire

Un propriétaire ne doit voir que les données rattachées à son `landlord_id`.

Cette règle doit être appliquée côté serveur et, si la base le permet, au niveau des politiques de sécurité.

### Règle d'accès locataire

Dans le MVP, le locataire ne doit pas avoir accès à un espace complet par défaut.

Il peut accéder à des éléments précis via un lien contrôlé : reçu, demande de preuve, échéance concernée.

### Règle d'accès administrateur

L'accès administrateur doit être limité, tracé et réservé aux besoins de support ou de sécurité.

Un administrateur ne doit pas pouvoir modifier silencieusement des données critiques.

## Suppression et archivage

### Suppression physique autorisée

La suppression physique peut être acceptable pour :

- brouillons sans impact ;
- données créées par erreur avant activation ;
- liens publics expirés sans historique utile ;
- événements techniques non critiques après politique de rétention.

### Suppression physique interdite ou à éviter

La suppression physique doit être évitée pour :

- baux actifs ou passés ;
- échéances générées ;
- encaissements ;
- allocations d'encaissement ;
- preuves de paiement ;
- reçus ;
- relances envoyées ;
- audit logs.

Pour ces éléments, préférer :

- `archived` ;
- `cancelled` ;
- `reversed` ;
- `deleted_at` avec audit ;
- création d'une correction.

## Données volontairement exclues du MVP

Le schéma MVP n'inclut pas encore :

- agences immobilières complexes ;
- multi-propriétaires avancés ;
- équipes et rôles granulaires ;
- comptabilité complète ;
- facturation Ranti ;
- abonnements ;
- scoring de locataire ;
- marketplace ;
- contrats juridiques avancés ;
- paiements en ligne obligatoires ;
- rapprochement bancaire automatique ;
- analytics avancés.

Ces sujets peuvent être ajoutés plus tard uniquement si le terrain les justifie.

## Questions ouvertes

Les points suivants doivent être confirmés avant migration SQL finale :

1. Le prestataire d'authentification initial.
2. Le format exact de l'identifiant utilisateur.
3. Le choix final entre `rent_due` et `rent_installment` dans le code.
4. Le niveau d'interaction locataire sans compte.
5. La politique de stockage des preuves.
6. La durée d'expiration des liens publics.
7. Le format du numéro de reçu.
8. La stratégie exacte de génération des échéances.
9. La gestion des paiements couvrant plusieurs mois.
10. La stratégie de correction d'un reçu déjà généré.

## Ordre recommandé des migrations

1. `app_users`
2. `landlords`
3. `properties`
4. `units`
5. `tenants`
6. `leases`
7. `rent_dues`
8. `collections`
9. `collection_allocations`
10. `payment_proofs`
11. `receipts`
12. `receipt_items`
13. `reminders`
14. `notification_deliveries`
15. `audit_logs`
16. `public_links`

L'ordre peut évoluer techniquement, mais il doit respecter la dépendance métier : on ne suit pas une échéance sans bail, on ne confirme pas un encaissement sans obligation, et on ne génère pas de reçu sans encaissement confirmé.

## Phrase de contrôle

La base de données de Ranti doit pouvoir raconter l'histoire suivante sans ambiguïté :

> Ce propriétaire a ce logement. Ce locataire l'occupe selon ce bail. Pour ce mois, cette échéance était attendue. Voici ce qui a été encaissé. Voici la preuve. Voici le reçu. Voici la relance si nécessaire. Voici l'historique des actions.

Si le schéma ne permet plus de raconter cette histoire simplement, il doit être corrigé.
