# Ranti — API

## Status

Version 2.2 — alignée avec le registre actif, ADR-001, ADR-006 et ADR-007.

Ce document définit l'architecture API de Ranti. Il n'est pas une spécification OpenAPI et n'engage pas les détails de payload.

## Purpose

L'API de Ranti doit permettre au propriétaire de répondre à cinq questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque loyer reçu ?
4. Quelle relance est prévue, préparée ou envoyée ?
5. Quel reçu ou quelle quittance a été généré après validation ?

L'API n'est pas une couche CRUD. Elle applique les règles métier, contrôle les permissions, protège les données sensibles, trace les actions sensibles et empêche les transitions invalides.

## Product Engines

### Reminder Engine

Le bail crée les échéances. Les échéances créent les rappels et relances.

Le propriétaire configure les règles de rappel/relance. Ranti prépare, planifie ou envoie selon le niveau d'automatisation disponible.

### Proof Engine

Le paiement validé crée la preuve.

Après validation d'une réception de loyer par le propriétaire, Ranti génère automatiquement le document adapté : reçu de paiement partiel, reçu complet ou quittance.

## API Principles

- Le serveur décide.
- Une action métier sensible passe par un endpoint explicite.
- Les mutations sensibles sont auditées.
- Les lectures sont filtrées par propriétaire.
- WhatsApp, SMS, PDF, stockage et paiement sont des adaptateurs externes.
- Aucun prestataire externe ne décide du statut métier final.

---

## Authentication

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/me` | Résoudre l'utilisateur courant, son propriétaire et ses permissions |
| `POST` | `/api/onboarding/landlord` | Créer l'espace propriétaire initial |

Règles : session obligatoire sur routes privées, rôle MVP `landlord_owner`, téléphone + mot de passe comme connexion principale, OTP pour vérification initiale ou action sensible.

---

## Landlords

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/landlords/me` | Consulter le profil du propriétaire courant |
| `PATCH` | `/api/landlords/me` | Modifier les informations du propriétaire courant |

Règles : un propriétaire ne peut accéder qu'à son propre espace. Le `landlord_id` est résolu depuis la session.

---

## Properties

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/properties` | Lister les propriétés |
| `POST` | `/api/properties` | Créer une propriété |
| `GET` | `/api/properties/{id}` | Consulter une propriété |
| `PATCH` | `/api/properties/{id}` | Modifier une propriété |
| `POST` | `/api/properties/{id}/archive` | Archiver une propriété |

Règles : une propriété appartient au propriétaire courant. L'archivage ne supprime pas logements, baux ou historiques.

---

## Units

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/units` | Lister les logements |
| `POST` | `/api/units` | Créer un logement |
| `GET` | `/api/units/{id}` | Consulter un logement |
| `PATCH` | `/api/units/{id}` | Modifier un logement |
| `POST` | `/api/units/{id}/archive` | Archiver un logement |

Règles : le logement appartient à une propriété du propriétaire courant. Un logement avec bail actif ne se supprime pas physiquement.

---

## Tenants

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/tenants` | Lister les locataires |
| `POST` | `/api/tenants` | Créer un locataire |
| `GET` | `/api/tenants/{id}` | Consulter un locataire |
| `PATCH` | `/api/tenants/{id}` | Modifier un locataire |
| `POST` | `/api/tenants/{id}/archive` | Archiver un locataire |

Règles : le locataire est rattaché au propriétaire courant. L'archivage ne supprime pas l'historique.

---

## Leases

Responsabilité : représenter les baux ou accords locatifs. Le bail est la source des échéances et des règles de rappel/relance.

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/leases` | Lister les baux |
| `POST` | `/api/leases` | Créer un bail |
| `GET` | `/api/leases/{id}` | Consulter un bail |
| `PATCH` | `/api/leases/{id}` | Modifier un bail |
| `POST` | `/api/leases/{id}/activate` | Activer un bail |
| `POST` | `/api/leases/{id}/end` | Terminer un bail |

Règles : le logement et le locataire doivent appartenir au propriétaire courant. Deux baux actifs ne peuvent pas couvrir le même logement sur la même période. L'activation peut générer les échéances et les règles de rappel par défaut.

---

## Lease Reminder Rules

Responsabilité : définir les règles qui permettent à Ranti de préparer ou automatiser les rappels et relances à partir du bail.

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/leases/{id}/reminder-rules` | Lister les règles d'un bail |
| `POST` | `/api/leases/{id}/reminder-rules` | Créer une règle |
| `PATCH` | `/api/reminder-rules/{id}` | Modifier une règle |
| `POST` | `/api/reminder-rules/{id}/activate` | Activer une règle |
| `POST` | `/api/reminder-rules/{id}/deactivate` | Désactiver une règle |
| `POST` | `/api/leases/{id}/reminders/generate` | Générer les rappels/relances prévus à partir des règles du bail |

Règles : une règle appartient toujours à un bail du propriétaire courant. Une règle inactive ne génère plus de nouvelles relances. Types candidats : `before_due_reminder`, `due_day_reminder`, `after_due_reminder`. Canaux candidats : `manual`, `whatsapp`, `sms`, `email`.

Contraintes : la génération doit être idempotente. Une même règle ne doit pas créer plusieurs relances identiques pour la même échéance.

---

## Rent Schedules

Responsabilité : représenter les obligations de paiement mensuelles. C'est le module central du MVP.

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/rent-dues` | Lister les échéances |
| `GET` | `/api/rent-dues/summary` | Synthèse : attendues, payées, en retard, restant dû, relances prévues |
| `GET` | `/api/rent-dues/{id}` | Consulter une échéance avec réceptions, preuves, reçus/quittances et relances |
| `POST` | `/api/leases/{id}/rent-dues/generate` | Générer les échéances d'un bail |
| `POST` | `/api/rent-dues/{id}/cancel` | Annuler une échéance avec trace |
| `POST` | `/api/rent-dues/mark-overdue` | Marquer les échéances en retard selon leur date limite |

Règles : une échéance naît d'un bail. L'unicité `(lease_id, period_start, period_end)` est obligatoire. Statuts visibles MVP : `expected`, `overdue`, `paid`, `cancelled`.

---

## Rent Receptions

Responsabilité : représenter les loyers reçus du point de vue du propriétaire.

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/rent-receptions` | Lister les réceptions de loyer |
| `POST` | `/api/rent-receptions` | Enregistrer une réception de loyer |
| `GET` | `/api/rent-receptions/{id}` | Consulter une réception de loyer |
| `POST` | `/api/rent-receptions/{id}/confirm` | Confirmer une réception et générer automatiquement les documents adaptés |
| `POST` | `/api/rent-receptions/{id}/cancel` | Annuler une réception de loyer |

Règles : le locataire et chaque échéance allouée doivent appartenir au propriétaire courant. La somme des allocations ne peut pas dépasser le montant reçu. Après confirmation, Ranti génère automatiquement le document adapté.

Paiement partiel validé : reçu de paiement partiel.

Échéance soldée : quittance ou reçu complet.

Statuts candidats : `draft`, `pending_confirmation`, `confirmed`, `cancelled`, `reversed`.

Contraintes : `Idempotency-Key` recommandé sur création et confirmation. La génération automatique de documents doit être idempotente.

---

## Proofs

| Méthode | Path | Use Case |
|---------|------|----------|
| `POST` | `/api/proofs/upload-url` | Obtenir une URL d'upload sécurisé |
| `POST` | `/api/proofs` | Attacher une preuve après upload |
| `GET` | `/api/proofs/{id}` | Consulter les métadonnées d'une preuve |
| `POST` | `/api/proofs/{id}/archive` | Archiver une preuve |

Règles : la preuve est facultative dans le MVP. Lorsqu'elle existe, elle est liée d'abord à une réception de loyer. Les fichiers ne sont jamais publics sans contrôle.

---

## Receipts and Quittances

Responsabilité : générer et conserver les reçus et quittances.

L'action produit principale est la validation du paiement, pas la création manuelle d'un reçu.

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/receipts` | Lister les reçus/quittances |
| `GET` | `/api/receipts/{id}` | Consulter un reçu ou une quittance |
| `POST` | `/api/receipts/{id}/cancel` | Annuler un document avec trace |
| `POST` | `/api/receipts/{id}/replace` | Remplacer un document via flux de correction |
| `POST` | `/api/rent-receptions/{id}/documents/generate` | Régénérer les documents attendus si la génération automatique a échoué |

Règles : un document ne peut pas être généré sans réception confirmée. Un numéro unique par propriétaire est généré. Un snapshot des données est créé à la génération. Toute correction nécessite annulation ou remplacement tracé.

Types candidats : `partial_payment_receipt`, `full_period_receipt`, `rent_quittance`.

Contraintes : le endpoint `/api/rent-receptions/{id}/documents/generate` est un fallback technique, pas le flux produit principal.

---

## Reminders

Responsabilité : représenter les rappels et relances pour les échéances à venir, impayées ou en retard.

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/reminders` | Lister les rappels/relances |
| `GET` | `/api/reminders/{id}` | Consulter une relance |
| `POST` | `/api/reminders/generate-due` | Générer les rappels/relances prévus |
| `POST` | `/api/reminders/{id}/cancel` | Annuler une relance prévue |
| `POST` | `/api/reminders/{id}/queue` | Mettre une relance en file d'envoi |
| `POST` | `/api/reminders/{id}/send` | Envoyer une relance via canal externe, Post-MVP ou MVP contrôlé |
| `POST` | `/api/reminders/{id}/retry` | Réessayer un envoi échoué, Post-MVP |

Règles : une relance doit être liée à une échéance du propriétaire courant. Une relance peut être générée depuis une règle de bail. Une relance ne confirme jamais un paiement et ne modifie jamais un reçu ou une quittance.

Contraintes : la génération doit éviter les doublons par règle, échéance et canal. Les tentatives détaillées d'envoi iront dans `notification_deliveries` Post-MVP.

---

## Dashboard and Summary

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/dashboard/monthly` | Synthèse mensuelle propriétaire |

Le dashboard doit montrer : loyers attendus, encaissés, reste à encaisser, retards, relances prévues ou envoyées, paiements validés, documents générés et actions utiles.

---

## Cross-cutting Concerns

### Authentication

Chaque requête authentifiée résout : `current_user`, `current_landlord`, rôle courant, permissions applicables.

### Authorization

Un propriétaire ne peut jamais accéder aux données d'un autre propriétaire. Une ressource hors périmètre retourne `404`.

### Validation

Chaque mutation valide : champs requis, longueurs de texte, montants positifs, devise, dates cohérentes, statuts valides, appartenance au propriétaire courant et cohérence entre objets liés.

### Transactions

Actions transactionnelles : créer un bail et générer ses échéances ; créer ou modifier les règles de rappel ; générer les relances prévues ; confirmer une réception ; générer automatiquement un document ; annuler ou remplacer un document ; mettre en file ou envoyer une relance.

### Audit

Actions auditées : onboarding, propriété, logement, locataire, bail, règle de rappel, échéance, marquage overdue, relance, réception de loyer, preuve, reçu/quittance, lien de partage futur.

### Idempotency

`Idempotency-Key` recommandé pour : génération d'échéances, génération de relances, mise en file/envoi de relance, création/confirmation de réception, génération ou remplacement de document, webhooks futurs de paiement.

### Errors

Réponse réussie : `{ "data": {}, "meta": {} }`.

Erreur : `{ "error": { "code": "string", "message": "string", "details": {} } }`.

Codes HTTP : `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`.

Codes métier candidats : `AUTH_REQUIRED`, `ACCESS_DENIED`, `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_STATE_TRANSITION`, `LANDLORD_MISMATCH`, `LEASE_ALREADY_ACTIVE`, `UNIT_ALREADY_OCCUPIED`, `RENT_DUE_ALREADY_EXISTS`, `REMINDER_RULE_INVALID`, `REMINDER_ALREADY_EXISTS`, `REMINDER_CHANNEL_UNAVAILABLE`, `RECEPTION_AMOUNT_INVALID`, `RECEPTION_ALREADY_CONFIRMED`, `RECEIPT_ALREADY_EXISTS`, `DOCUMENT_GENERATION_FAILED`, `RECEIPT_CORRECTION_REQUIRED`.

---

## MVP Guardrails

L'API doit refuser ou reporter : marketplace, CRM immobilier, portail locataire complet, comptabilité avancée, paiement en ligne obligatoire, wallet Ranti, envoi automatique externe non maîtrisé, analytics avancés, suppression silencieuse de données financières ou preuves.

## Phrase de contrôle

L'API de Ranti doit pouvoir raconter l'histoire suivante sans ambiguïté :

> Ce propriétaire a ce logement. Ce locataire l'occupe selon ce bail. Pour ce mois, cette échéance était attendue. Ranti savait quoi rappeler. Voici ce qui a été reçu et validé. Voici le reçu ou la quittance généré. Voici la relance prévue ou envoyée. Voici l'historique des actions.

Si une route API ne protège pas cette histoire, elle doit être corrigée ou retirée du MVP.
