# Ranti — Base de Données

## Statut

Version 1.0 — schéma relationnel candidat pour le MVP.

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

### Noms de tables

Les tables utilisent l'anglais simple, au pluriel.

Exemples :

- `landlords`
- `properties`
- `units`
- `tenants`
- `leases`
- `rent_dues`
- `collections`
- `payment_proofs`
- `receipts`
- `reminders`
- `audit_logs`

### Identifiants

Chaque table principale utilise :

- `id` comme identifiant primaire ;
- type recommandé : UUID ;
- génération côté base ou côté serveur de manière contrôlée.

### Dates

Les dates techniques utilisent des timestamps avec timezone.

Exemples :

- `created_at`
- `updated_at`
- `deleted_at`
- `confirmed_at`
- `sent_at`

Les dates métier simples utilisent des dates sans heure.

Exemples :

- `period_start`
- `period_end`
- `due_date`
- `lease_start_date`
- `lease_end_date`

### Devise

Chaque montant financier doit être associé à une devise.

Champ recommandé : `currency`.

Valeur initiale probable : `XOF`.

Ne pas supposer que Ranti restera seulement dans un pays.

## Tables principales

## 1. `app_users`

### Rôle

Représente l'utilisateur applicatif connecté.

Cette table complète le service d'authentification.

Elle ne remplace pas forcément la table interne du prestataire d'authentification.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant utilisateur applicatif |
| `auth_user_id` | uuid / text | Identifiant venant du service d'authentification |
| `full_name` | text | Nom affiché |
| `phone` | text | Téléphone principal |
| `email` | text nullable | Email si disponible |
| `status` | text | `active`, `disabled` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |

### Contraintes

- `auth_user_id` doit être unique si le prestataire d'authentification le permet.
- `phone` doit être unique si le téléphone devient l'identifiant principal.
- Un utilisateur désactivé ne doit pas pouvoir agir sur les données métier.

## 2. `landlords`

### Rôle

Représente le propriétaire ou l'espace propriétaire dans Ranti.

Dans le MVP, un utilisateur principal correspond généralement à un propriétaire.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant propriétaire |
| `owner_user_id` | uuid | Utilisateur qui possède l'espace |
| `display_name` | text | Nom du propriétaire ou de l'espace |
| `phone` | text nullable | Téléphone propriétaire |
| `country` | text nullable | Pays principal |
| `city` | text nullable | Ville principale |
| `default_currency` | text | Devise par défaut, ex. `XOF` |
| `status` | text | `active`, `disabled`, `archived` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `deleted_at` | timestamptz nullable | Suppression logique si nécessaire |

### Contraintes

- `owner_user_id` référence `app_users.id`.
- Pour le MVP, un `owner_user_id` peut être limité à un seul `landlord`.
- Toutes les données métier doivent être rattachées à `landlords.id`.

## 3. `properties`

### Rôle

Représente une propriété physique appartenant au propriétaire.

Une propriété peut contenir un ou plusieurs logements.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant propriété |
| `landlord_id` | uuid | Propriétaire concerné |
| `name` | text | Nom simple, ex. `Maison Agla` |
| `address_text` | text nullable | Adresse ou description simple |
| `city` | text nullable | Ville |
| `country` | text nullable | Pays |
| `status` | text | `active`, `archived` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `deleted_at` | timestamptz nullable | Suppression logique |

### Contraintes

- `landlord_id` référence `landlords.id`.
- Une propriété archivée ne doit pas supprimer ses logements, baux ou échéances.

## 4. `units`

### Rôle

Représente un logement ou espace louable situé dans une propriété.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant logement |
| `landlord_id` | uuid | Propriétaire concerné |
| `property_id` | uuid | Propriété concernée |
| `name` | text | Nom simple, ex. `Chambre 1`, `Boutique A` |
| `unit_type` | text nullable | `room`, `apartment`, `house`, `shop`, `office`, `warehouse`, `other` |
| `status` | text | `available`, `occupied`, `inactive`, `archived` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `deleted_at` | timestamptz nullable | Suppression logique |

### Contraintes

- `landlord_id` référence `landlords.id`.
- `property_id` référence `properties.id`.
- Le `landlord_id` du logement doit correspondre au `landlord_id` de la propriété.
- Un logement avec un bail actif ne doit pas être supprimé physiquement.

## 5. `tenants`

### Rôle

Représente un locataire connu du propriétaire.

Le locataire est secondaire dans le MVP, mais il doit être correctement représenté pour éviter les conflits.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant locataire |
| `landlord_id` | uuid | Propriétaire concerné |
| `full_name` | text | Nom du locataire |
| `phone` | text nullable | Téléphone principal |
| `email` | text nullable | Email si disponible |
| `notes` | text nullable | Note simple du propriétaire |
| `status` | text | `active`, `inactive`, `archived` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `deleted_at` | timestamptz nullable | Suppression logique |

### Contraintes

- `landlord_id` référence `landlords.id`.
- Le même numéro de téléphone peut exister chez plusieurs propriétaires.
- Ne pas imposer une unicité globale sur `phone` au niveau MVP.

## 6. `leases`

### Rôle

Représente le bail ou accord locatif.

Le bail définit les règles de génération des échéances.

Il ne doit pas être confondu avec un contrat PDF ou papier.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant bail |
| `landlord_id` | uuid | Propriétaire concerné |
| `property_id` | uuid | Propriété concernée |
| `unit_id` | uuid | Logement loué |
| `tenant_id` | uuid | Locataire concerné |
| `rent_amount` | integer | Montant attendu par période |
| `currency` | text | Devise, ex. `XOF` |
| `billing_period` | text | `monthly` au MVP |
| `due_day` | integer nullable | Jour attendu du paiement, ex. `5` |
| `start_date` | date | Début de la relation locative |
| `end_date` | date nullable | Fin prévue ou réelle |
| `status` | text | `draft`, `active`, `ended`, `suspended`, `cancelled` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `deleted_at` | timestamptz nullable | Suppression logique |

### Contraintes

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

### Rôle

Représente une échéance de loyer.

C'est la table centrale du MVP.

Une échéance existe même si le paiement n'a pas encore été effectué.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant échéance |
| `landlord_id` | uuid | Propriétaire concerné |
| `lease_id` | uuid | Bail source |
| `property_id` | uuid | Propriété concernée |
| `unit_id` | uuid | Logement concerné |
| `tenant_id` | uuid | Locataire concerné |
| `period_start` | date | Début de période couverte |
| `period_end` | date | Fin de période couverte |
| `due_date` | date | Date attendue du paiement |
| `amount_due` | integer | Montant attendu |
| `currency` | text | Devise |
| `amount_collected` | integer | Montant encaissé, dérivé contrôlé |
| `balance_due` | integer | Reste dû, dérivé contrôlé |
| `status` | text | Statut de l'échéance |
| `generated_from` | text | `lease`, `manual_adjustment` plus tard |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `cancelled_at` | timestamptz nullable | Annulation avec trace |
| `deleted_at` | timestamptz nullable | Suppression logique si nécessaire |

### Statuts candidats

- `upcoming` : l'échéance existe mais n'est pas encore due ;
- `due` : l'échéance est attendue ;
- `partially_collected` : une partie a été encaissée ;
- `collected` : le montant attendu est encaissé ;
- `overdue` : la date limite est dépassée et le montant n'est pas réglé ;
- `cancelled` : l'échéance a été annulée avec trace ;
- `disputed` : l'échéance fait l'objet d'une contestation.

### Contraintes

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

### Rôle

Représente un encaissement du point de vue du propriétaire.

Un encaissement peut régler une ou plusieurs échéances.

Une échéance peut recevoir plusieurs encaissements.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant encaissement |
| `landlord_id` | uuid | Propriétaire concerné |
| `tenant_id` | uuid | Locataire concerné |
| `amount` | integer | Montant encaissé |
| `currency` | text | Devise |
| `method` | text | Méthode d'encaissement |
| `status` | text | Statut de l'encaissement |
| `collected_at` | timestamptz | Date déclarée d'encaissement |
| `confirmed_at` | timestamptz nullable | Date de confirmation |
| `confirmed_by_user_id` | uuid nullable | Utilisateur confirmateur |
| `notes` | text nullable | Note simple |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `cancelled_at` | timestamptz nullable | Date d'annulation |
| `deleted_at` | timestamptz nullable | Suppression logique si nécessaire |

### Méthodes candidates

- `cash`
- `mobile_money`
- `bank_transfer`
- `manual`
- `online_payment`
- `other`

### Statuts candidats

- `draft` ;
- `pending_confirmation` ;
- `confirmed` ;
- `cancelled` ;
- `reversed`.

### Contraintes

- `amount` doit être supérieur à zéro.
- Un encaissement confirmé ne doit pas être supprimé physiquement.
- Une annulation ou correction doit être auditée.
- La confirmation MVP reste humaine côté propriétaire.

## 9. `collection_allocations`

### Rôle

Relie un encaissement à une ou plusieurs échéances.

Cette table est nécessaire pour gérer correctement :

- paiement partiel ;
- paiement en retard ;
- paiement couvrant plusieurs mois ;
- plusieurs paiements pour un même mois.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant allocation |
| `landlord_id` | uuid | Propriétaire concerné |
| `collection_id` | uuid | Encaissement concerné |
| `rent_due_id` | uuid | Échéance concernée |
| `amount_allocated` | integer | Montant affecté à cette échéance |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |

### Contraintes

- `collection_id` référence `collections.id`.
- `rent_due_id` référence `rent_dues.id`.
- `landlord_id` doit correspondre sur les deux côtés.
- `amount_allocated` doit être supérieur à zéro.
- La somme des allocations d'un encaissement ne doit pas dépasser le montant de l'encaissement.
- La somme des allocations confirmées sur une échéance détermine son montant encaissé.

## 10. `payment_proofs`

### Rôle

Représente une preuve de paiement ou d'encaissement.

Une preuve peut être liée à un encaissement, une échéance, ou les deux selon le moment où elle est ajoutée.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant preuve |
| `landlord_id` | uuid | Propriétaire concerné |
| `collection_id` | uuid nullable | Encaissement associé |
| `rent_due_id` | uuid nullable | Échéance associée |
| `uploaded_by_user_id` | uuid nullable | Utilisateur ayant ajouté la preuve |
| `uploaded_by_role` | text | `landlord`, `tenant`, `admin`, `system` |
| `file_url` | text | Référence interne ou URL protégée |
| `file_name` | text nullable | Nom du fichier |
| `mime_type` | text nullable | Type MIME |
| `file_size_bytes` | integer nullable | Taille |
| `status` | text | `active`, `rejected`, `archived` |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `deleted_at` | timestamptz nullable | Suppression logique |

### Contraintes

- Une preuve doit être reliée au minimum à une échéance ou un encaissement.
- Les fichiers doivent être protégés par des permissions.
- Une preuve rejetée ou archivée ne doit pas disparaître si elle a servi dans un conflit.

## 11. `receipts`

### Rôle

Représente une quittance ou un reçu généré par Ranti.

Un reçu doit être déterministe et généré à partir de données confirmées.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant reçu |
| `landlord_id` | uuid | Propriétaire concerné |
| `tenant_id` | uuid | Locataire concerné |
| `lease_id` | uuid | Bail concerné |
| `unit_id` | uuid | Logement concerné |
| `receipt_number` | text | Numéro lisible du reçu |
| `currency` | text | Devise |
| `total_amount` | integer | Montant total reçu |
| `issued_at` | timestamptz | Date de génération |
| `issued_by_user_id` | uuid | Utilisateur ayant généré le reçu |
| `status` | text | `issued`, `cancelled`, `replaced` |
| `pdf_file_url` | text nullable | Référence du PDF généré |
| `snapshot` | jsonb | Données figées utilisées pour générer le reçu |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |
| `cancelled_at` | timestamptz nullable | Annulation avec trace |

### Contraintes

- `receipt_number` doit être unique par propriétaire.
- Un reçu doit être lié à des encaissements confirmés.
- Un reçu généré ne doit pas être modifié silencieusement.
- Les informations importantes doivent être conservées dans `snapshot` pour garder la trace même si le locataire ou le logement change plus tard.

Contrainte recommandée :

```txt
unique(landlord_id, receipt_number)
```

## 12. `receipt_items`

### Rôle

Relie un reçu aux échéances et encaissements qu'il couvre.

Cette table évite de perdre la précision lorsque :

- un reçu couvre plusieurs mois ;
- un encaissement couvre plusieurs échéances ;
- plusieurs encaissements règlent une même échéance.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant ligne de reçu |
| `landlord_id` | uuid | Propriétaire concerné |
| `receipt_id` | uuid | Reçu concerné |
| `rent_due_id` | uuid | Échéance couverte |
| `collection_id` | uuid nullable | Encaissement associé |
| `amount` | integer | Montant couvert |
| `period_start` | date | Début de période copiée |
| `period_end` | date | Fin de période copiée |
| `created_at` | timestamptz | Date de création |

### Contraintes

- `receipt_id` référence `receipts.id`.
- `rent_due_id` référence `rent_dues.id`.
- `collection_id` référence `collections.id` si présent.
- `amount` doit être supérieur à zéro.

## 13. `reminders`

### Rôle

Représente une relance liée à une échéance.

La relance existe dans Ranti même si l'envoi externe échoue.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant relance |
| `landlord_id` | uuid | Propriétaire concerné |
| `rent_due_id` | uuid | Échéance concernée |
| `tenant_id` | uuid | Locataire concerné |
| `channel` | text | `whatsapp`, `sms`, `email`, `manual` |
| `message` | text | Message envoyé ou préparé |
| `status` | text | `draft`, `queued`, `sent`, `failed`, `cancelled` |
| `sent_at` | timestamptz nullable | Date d'envoi |
| `created_by_user_id` | uuid nullable | Utilisateur créateur |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |

### Contraintes

- Une relance doit être liée à une échéance.
- Le canal ne doit pas devenir la source de vérité.
- Une relance envoyée doit rester visible dans l'historique.

## 14. `notification_deliveries`

### Rôle

Trace les tentatives d'envoi via les canaux externes.

Cette table est technique.

Elle ne remplace pas `reminders`.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant tentative |
| `landlord_id` | uuid | Propriétaire concerné |
| `reminder_id` | uuid nullable | Relance associée |
| `channel` | text | Canal utilisé |
| `recipient` | text | Téléphone ou email destinataire |
| `provider` | text nullable | Prestataire utilisé |
| `provider_message_id` | text nullable | Identifiant externe |
| `status` | text | `queued`, `sent`, `delivered`, `failed` |
| `error_message` | text nullable | Erreur éventuelle |
| `sent_at` | timestamptz nullable | Date d'envoi |
| `delivered_at` | timestamptz nullable | Date de livraison si disponible |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de modification |

### Contraintes

- Ne pas stocker plus de données personnelles que nécessaire.
- Les erreurs doivent aider au diagnostic sans exposer inutilement des données sensibles.

## 15. `audit_logs`

### Rôle

Trace les actions sensibles.

Cette table protège la confiance dans Ranti.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant audit |
| `landlord_id` | uuid nullable | Propriétaire concerné si applicable |
| `actor_user_id` | uuid nullable | Utilisateur auteur |
| `actor_role` | text | `landlord`, `tenant`, `admin`, `system` |
| `action` | text | Action réalisée |
| `entity_type` | text | Type d'objet concerné |
| `entity_id` | uuid nullable | Identifiant de l'objet |
| `before_data` | jsonb nullable | Ancien état si nécessaire |
| `after_data` | jsonb nullable | Nouvel état si nécessaire |
| `metadata` | jsonb nullable | Contexte technique minimal |
| `created_at` | timestamptz | Date de l'action |

### Actions candidates

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

### Contraintes

- Les logs d'audit doivent être append-only autant que possible.
- Ils ne doivent pas être modifiés par des flux utilisateur standards.
- Ils ne doivent pas contenir inutilement des fichiers ou données très sensibles en clair.

## 16. `public_links`

### Rôle

Représente les liens partageables contrôlés.

Ces liens peuvent servir à :

- ouvrir un reçu ;
- transmettre une preuve ;
- consulter une relance ;
- permettre une action locataire sans compte complet.

### Champs candidats

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Identifiant lien |
| `landlord_id` | uuid | Propriétaire concerné |
| `token_hash` | text | Hash du token public |
| `purpose` | text | `view_receipt`, `upload_proof`, `view_rent_due` |
| `entity_type` | text | Objet lié |
| `entity_id` | uuid | Identifiant de l'objet lié |
| `expires_at` | timestamptz nullable | Expiration |
| `revoked_at` | timestamptz nullable | Révocation |
| `created_at` | timestamptz | Date de création |
| `last_used_at` | timestamptz nullable | Dernière utilisation |

### Contraintes

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

te​​nants
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
