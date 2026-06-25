# Ranti — API

## Statut

Version 1.0 — contrat API candidat pour le MVP.

Ce document définit la première architecture API de Ranti.

Il ne s'agit pas encore d'une spécification OpenAPI complète, ni d'un engagement définitif sur chaque route.

Il sert à définir les use cases serveur, les règles de sécurité, les conventions de réponse, les transitions métier et les endpoints candidats avant implémentation.

## Objectif

L'API de Ranti doit protéger le domaine métier.

Elle doit permettre au produit de répondre simplement à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque paiement ?

L'API ne doit pas être une simple couche CRUD.

Elle doit appliquer les règles métier, vérifier les permissions, protéger les données sensibles, créer les logs d'audit et empêcher les transitions invalides.

## Position dans l'architecture

L'API appartient à la couche Application / Use Cases.

Elle orchestre :

- l'identité utilisateur ;
- les permissions ;
- les validations ;
- les appels au domaine ;
- les transactions ;
- les adaptateurs externes ;
- les logs d'audit ;
- les réponses envoyées à l'interface.

L'API ne doit pas placer les règles métier critiques uniquement dans l'interface utilisateur.

## Style API recommandé

Pour le MVP, Ranti peut utiliser une API HTTP simple, orientée ressources et use cases.

Le style recommandé est REST pragmatique :

- `GET` pour lire ;
- `POST` pour créer ou déclencher une action métier ;
- `PATCH` pour modifier partiellement ;
- `DELETE` uniquement pour les suppressions non critiques ou les suppressions logiques contrôlées.

Les actions métier importantes peuvent utiliser des endpoints explicites.

Exemples :

- `POST /api/collections/{id}/confirm`
- `POST /api/receipts`
- `POST /api/reminders/{id}/send`

Ces routes sont préférables à des modifications ambiguës de statut envoyées depuis l'interface.

## Principes API

### 1. Le serveur décide

Le serveur vérifie toujours :

- l'identité ;
- le `landlord_id` ;
- les permissions ;
- l'existence des objets ;
- la cohérence des relations ;
- les transitions métier ;
- les règles de sécurité.

L'interface peut proposer une action, mais elle ne décide pas seule.

### 2. Toutes les mutations sensibles sont auditées

Une mutation sensible doit créer un événement dans `audit_logs`.

Exemples :

- création d'un bail ;
- activation d'un bail ;
- génération d'une échéance ;
- création d'un encaissement ;
- confirmation d'un encaissement ;
- annulation d'un encaissement ;
- ajout d'une preuve ;
- génération d'un reçu ;
- création ou envoi d'une relance.

### 3. Les lectures sont filtrées par propriétaire

Toute lecture métier doit être filtrée par le propriétaire courant.

Un propriétaire ne doit jamais pouvoir lire un objet d'un autre propriétaire, même s'il connaît son identifiant.

### 4. Les mutations critiques sont transactionnelles

Les actions qui modifient plusieurs tables doivent être transactionnelles.

Exemples :

- créer un bail et générer ses échéances ;
- confirmer un encaissement et mettre à jour les échéances ;
- générer un reçu et ses lignes ;
- créer une relance et enregistrer une tentative de notification.

### 5. Les providers externes restent derrière des adaptateurs

L'API ne doit pas exposer directement les détails d'un prestataire WhatsApp, SMS, PDF, stockage ou paiement.

Les providers externes sont des adaptateurs.

Le domaine Ranti reste propriétaire des règles.

### 6. Idempotence sur les actions sensibles

Les actions sensibles doivent pouvoir être protégées par une clé d'idempotence.

Recommandé pour :

- création d'encaissement ;
- confirmation d'encaissement ;
- génération de reçu ;
- envoi de relance ;
- webhooks futurs de paiement.

Champ recommandé : header `Idempotency-Key`.

## Authentification et contexte utilisateur

Chaque requête authentifiée doit résoudre :

- `current_user` ;
- `current_landlord` ;
- rôle courant ;
- permissions applicables.

Pour le MVP, le rôle principal est `landlord_owner`.

Les rôles avancés sont reportés.

Rôles candidats :

- `landlord_owner` ;
- `tenant_link_user` ;
- `admin` ;
- `system`.

## Format de réponse

### Réponse réussie

Format recommandé :

```json
{
  "data": {},
  "meta": {}
}
```

`meta` est optionnel.

Il peut contenir :

- pagination ;
- filtres appliqués ;
- informations de contexte ;
- avertissements non bloquants.

### Réponse d'erreur

Format recommandé :

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

Le message doit être compréhensible.

Les détails ne doivent pas exposer d'information sensible.

## Codes HTTP recommandés

- `200 OK` : lecture ou action réussie ;
- `201 Created` : ressource créée ;
- `400 Bad Request` : entrée invalide ;
- `401 Unauthorized` : utilisateur non authentifié ;
- `403 Forbidden` : utilisateur authentifié mais non autorisé ;
- `404 Not Found` : ressource inexistante ou inaccessible ;
- `409 Conflict` : conflit métier ou transition impossible ;
- `422 Unprocessable Entity` : données valides techniquement mais invalides métier ;
- `429 Too Many Requests` : limite dépassée ;
- `500 Internal Server Error` : erreur serveur inattendue.

Pour éviter les fuites de données, une ressource appartenant à un autre propriétaire peut être retournée comme `404 Not Found`.

## Codes d'erreur candidats

- `AUTH_REQUIRED`
- `ACCESS_DENIED`
- `RESOURCE_NOT_FOUND`
- `VALIDATION_ERROR`
- `INVALID_STATE_TRANSITION`
- `LANDLORD_MISMATCH`
- `LEASE_ALREADY_ACTIVE`
- `UNIT_ALREADY_OCCUPIED`
- `RENT_DUE_ALREADY_EXISTS`
- `COLLECTION_AMOUNT_INVALID`
- `COLLECTION_ALREADY_CONFIRMED`
- `COLLECTION_NOT_CONFIRMED`
- `ALLOCATION_EXCEEDS_COLLECTION`
- `RECEIPT_REQUIRES_CONFIRMED_COLLECTION`
- `REMINDER_REQUIRES_RENT_DUE`
- `PUBLIC_LINK_EXPIRED`
- `PUBLIC_LINK_REVOKED`
- `RATE_LIMITED`

## Endpoints candidats

## 1. Session et utilisateur courant

### `GET /api/me`

Retourne l'utilisateur courant, son propriétaire courant et ses permissions.

Utilisé pour initialiser l'application.

Réponse candidate :

```json
{
  "data": {
    "user": {},
    "landlord": {},
    "role": "landlord_owner",
    "permissions": []
  }
}
```

### `POST /api/onboarding/landlord`

Crée l'espace propriétaire initial pour l'utilisateur courant.

Use case : `createLandlordWorkspace`.

Règles :

- l'utilisateur doit être authentifié ;
- un utilisateur ne doit pas créer plusieurs espaces propriétaire au MVP, sauf décision future ;
- l'action doit être auditée.

## 2. Propriétés

### `GET /api/properties`

Liste les propriétés du propriétaire courant.

Filtres candidats :

- `status`
- `city`

### `POST /api/properties`

Crée une propriété.

Use case : `createProperty`.

Règles :

- rattacher automatiquement au `current_landlord` ;
- valider les champs simples ;
- créer un audit log.

### `GET /api/properties/{property_id}`

Retourne une propriété accessible au propriétaire courant.

### `PATCH /api/properties/{property_id}`

Modifie une propriété.

Règles :

- vérifier l'appartenance au propriétaire ;
- ne pas casser les relations existantes ;
- auditer les modifications importantes.

### `POST /api/properties/{property_id}/archive`

Archive une propriété.

Cette action ne supprime pas les logements, baux, échéances ou historiques associés.

## 3. Logements

### `GET /api/units`

Liste les logements du propriétaire courant.

Filtres candidats :

- `property_id`
- `status`
- `unit_type`

### `POST /api/units`

Crée un logement.

Use case : `createUnit`.

Règles :

- la propriété doit appartenir au propriétaire courant ;
- le logement hérite du `landlord_id` ;
- l'action doit être auditée.

### `GET /api/units/{unit_id}`

Retourne un logement accessible au propriétaire courant.

### `PATCH /api/units/{unit_id}`

Modifie un logement.

### `POST /api/units/{unit_id}/archive`

Archive un logement.

Règles :

- un logement avec bail actif ne doit pas être supprimé physiquement ;
- l'action doit être auditée.

## 4. Locataires

### `GET /api/tenants`

Liste les locataires du propriétaire courant.

Filtres candidats :

- `status`
- `search`

### `POST /api/tenants`

Crée un locataire.

Use case : `createTenant`.

Règles :

- ne pas imposer d'unicité globale sur le téléphone ;
- rattacher au propriétaire courant ;
- auditer l'action.

### `GET /api/tenants/{tenant_id}`

Retourne un locataire accessible au propriétaire courant.

### `PATCH /api/tenants/{tenant_id}`

Modifie un locataire.

### `POST /api/tenants/{tenant_id}/archive`

Archive un locataire sans supprimer l'historique.

## 5. Baux

### `GET /api/leases`

Liste les baux du propriétaire courant.

Filtres candidats :

- `status`
- `unit_id`
- `tenant_id`

### `POST /api/leases`

Crée un bail.

Use case : `createLease`.

Règles :

- le logement doit appartenir au propriétaire courant ;
- le locataire doit appartenir au propriétaire courant ;
- le logement ne doit pas avoir deux baux actifs sur la même période ;
- `rent_amount` doit être positif ;
- `billing_period` est `monthly` au MVP ;
- l'action doit être auditée.

### `GET /api/leases/{lease_id}`

Retourne un bail accessible au propriétaire courant.

### `PATCH /api/leases/{lease_id}`

Modifie un bail.

Règles :

- certaines modifications peuvent être interdites si des échéances existent déjà ;
- les changements sensibles doivent être audités ;
- les impacts sur les échéances doivent être explicites.

### `POST /api/leases/{lease_id}/activate`

Active un bail.

Use case : `activateLease`.

Règles :

- le bail doit être en statut compatible ;
- le logement doit être disponible ou compatible ;
- l'activation peut déclencher la génération initiale d'échéances ;
- l'action doit être transactionnelle ;
- l'action doit être auditée.

### `POST /api/leases/{lease_id}/end`

Termine un bail.

Règles :

- ne pas supprimer l'historique ;
- garder les échéances, encaissements, preuves et reçus passés ;
- auditer l'action.

## 6. Échéances de loyer

### `GET /api/rent-dues`

Liste les échéances du propriétaire courant.

Filtres candidats :

- `status`
- `tenant_id`
- `unit_id`
- `lease_id`
- `from`
- `to`

Ce endpoint sert directement le suivi mensuel des loyers.

### `GET /api/rent-dues/summary`

Retourne une synthèse simple pour le propriétaire.

Questions à couvrir :

- combien d'échéances sont dues ;
- combien sont en retard ;
- combien a été encaissé ;
- combien reste dû ;
- quelles actions sont nécessaires aujourd'hui.

Ce endpoint ne doit pas devenir un dashboard analytique avancé.

### `GET /api/rent-dues/{rent_due_id}`

Retourne une échéance et ses éléments associés :

- bail ;
- logement ;
- locataire ;
- encaissements ;
- preuves ;
- reçus ;
- relances.

### `POST /api/leases/{lease_id}/rent-dues/generate`

Génère les échéances pour un bail.

Use case : `generateRentDuesForLease`.

Règles :

- le bail doit être actif ou compatible ;
- ne pas générer deux fois la même période ;
- respecter `unique(lease_id, period_start, period_end)` ;
- action transactionnelle ;
- action auditée.

### `POST /api/rent-dues/{rent_due_id}/cancel`

Annule une échéance avec trace.

Règles :

- ne pas supprimer physiquement ;
- refuser si des encaissements confirmés rendent l'annulation incohérente, sauf flux de correction dédié ;
- auditer l'action.

## 7. Encaissements

### `GET /api/collections`

Liste les encaissements du propriétaire courant.

Filtres candidats :

- `tenant_id`
- `status`
- `method`
- `from`
- `to`

### `POST /api/collections`

Crée un encaissement.

Use case : `createCollection`.

Payload candidat :

```json
{
  "tenant_id": "uuid",
  "amount": 50000,
  "currency": "XOF",
  "method": "mobile_money",
  "collected_at": "2026-07-05T10:30:00Z",
  "allocations": [
    {
      "rent_due_id": "uuid",
      "amount_allocated": 50000
    }
  ],
  "notes": "Capture reçue sur WhatsApp"
}
```

Règles :

- le locataire doit appartenir au propriétaire courant ;
- chaque échéance doit appartenir au propriétaire courant ;
- le montant doit être positif ;
- la somme des allocations ne doit pas dépasser le montant ;
- l'encaissement ne dépend pas d'un prestataire de paiement ;
- action transactionnelle ;
- action auditée.

### `GET /api/collections/{collection_id}`

Retourne un encaissement accessible au propriétaire courant.

### `POST /api/collections/{collection_id}/confirm`

Confirme un encaissement.

Use case : `confirmCollection`.

Règles :

- l'encaissement doit appartenir au propriétaire courant ;
- l'encaissement ne doit pas être déjà confirmé ;
- les allocations doivent être cohérentes ;
- mettre à jour les montants dérivés des échéances ;
- mettre à jour les statuts des échéances ;
- action transactionnelle ;
- action auditée.

### `POST /api/collections/{collection_id}/cancel`

Annule un encaissement.

Règles :

- ne pas supprimer physiquement ;
- si un reçu existe déjà, refuser ou exiger un flux de correction ;
- recalculer les échéances concernées si nécessaire ;
- action transactionnelle ;
- action auditée.

## 8. Preuves de paiement

### `POST /api/payment-proofs/upload-url`

Prépare un upload sécurisé.

Use case : `createPaymentProofUploadUrl`.

Règles :

- vérifier l'accès à l'échéance ou à l'encaissement ;
- limiter le type et la taille du fichier ;
- retourner une URL ou un mécanisme d'upload contrôlé ;
- ne pas rendre le fichier public.

### `POST /api/payment-proofs`

Enregistre une preuve après upload.

Use case : `attachPaymentProof`.

Règles :

- la preuve doit être liée à une échéance, un encaissement, ou les deux ;
- le fichier doit être protégé ;
- l'action doit être auditée.

### `GET /api/payment-proofs/{proof_id}`

Retourne les métadonnées d'une preuve accessible.

### `POST /api/payment-proofs/{proof_id}/archive`

Archive une preuve sans supprimer l'historique.

## 9. Reçus et quittances

### `GET /api/receipts`

Liste les reçus du propriétaire courant.

Filtres candidats :

- `tenant_id`
- `lease_id`
- `from`
- `to`
- `status`

### `POST /api/receipts`

Génère un reçu.

Use case : `generateReceipt`.

Payload candidat :

```json
{
  "collection_ids": ["uuid"],
  "rent_due_ids": ["uuid"]
}
```

Règles :

- les encaissements doivent appartenir au propriétaire courant ;
- les encaissements doivent être confirmés ;
- les échéances doivent être cohérentes avec les encaissements ;
- générer un numéro de reçu unique par propriétaire ;
- créer un `snapshot` des données utilisées ;
- créer les `receipt_items` ;
- générer le PDF via adaptateur si disponible ;
- action transactionnelle ;
- action auditée.

### `GET /api/receipts/{receipt_id}`

Retourne un reçu accessible au propriétaire courant.

### `POST /api/receipts/{receipt_id}/share-link`

Crée un lien contrôlé pour partager le reçu.

Règles :

- stocker le hash du token, jamais le token brut ;
- définir une expiration si nécessaire ;
- limiter le lien à la consultation du reçu.

### `POST /api/receipts/{receipt_id}/cancel`

Annule un reçu avec trace.

Règles :

- ne pas supprimer physiquement ;
- auditer ;
- prévoir plus tard un flux `replaced` si un reçu corrigé est généré.

## 10. Relances

### `GET /api/reminders`

Liste les relances du propriétaire courant.

Filtres candidats :

- `rent_due_id`
- `tenant_id`
- `channel`
- `status`

### `POST /api/reminders`

Crée une relance.

Use case : `createReminder`.

Payload candidat :

```json
{
  "rent_due_id": "uuid",
  "channel": "whatsapp",
  "message": "Bonjour, votre loyer de juillet est en attente."
}
```

Règles :

- l'échéance doit appartenir au propriétaire courant ;
- la relance doit être liée à une échéance ;
- le message doit être clair et non agressif ;
- action auditée.

### `POST /api/reminders/{reminder_id}/send`

Envoie une relance via un canal externe.

Use case : `sendReminder`.

Règles :

- la relance doit exister dans Ranti ;
- le canal externe est un adaptateur ;
- créer une tentative dans `notification_deliveries` ;
- mettre à jour le statut ;
- gérer l'échec sans perdre l'historique ;
- action auditée.

## 11. Liens publics contrôlés

### `GET /p/{token}`

Résout un lien public contrôlé.

Usages possibles :

- consultation d'un reçu ;
- upload de preuve ;
- consultation d'une échéance limitée.

Règles :

- comparer le hash du token ;
- vérifier l'expiration ;
- vérifier la révocation ;
- limiter strictement l'accès au but du lien ;
- ne pas exposer l'espace propriétaire complet.

### `POST /api/public-links/{link_id}/revoke`

Révoque un lien public.

Règles :

- seul le propriétaire concerné ou un acteur autorisé peut révoquer ;
- action auditée si le lien concerne une donnée sensible.

## 12. Audit logs

### `GET /api/audit-logs`

Liste les logs d'audit accessibles.

Usage MVP : support interne ou vue propriétaire limitée si nécessaire.

Filtres candidats :

- `entity_type`
- `entity_id`
- `action`
- `from`
- `to`

Règles :

- ne pas exposer les données sensibles inutilement ;
- limiter l'accès ;
- ne pas permettre de modification via API standard.

## Endpoints exclus du MVP

Les endpoints suivants sont exclus au MVP :

- gestion complète des agences ;
- rôles granulaires d'équipe ;
- marketplace ;
- scoring locataire ;
- comptabilité complète ;
- facturation avancée Ranti ;
- rapprochement bancaire automatique ;
- recouvrement automatisé agressif ;
- analytics avancés.

## Webhooks futurs

Les webhooks ne sont pas prioritaires dans le MVP si la validation reste humaine.

Ils pourront être ajoutés plus tard pour :

- paiement en ligne ;
- statut de notification ;
- génération PDF asynchrone ;
- stockage ou scan de documents.

Règles webhooks futures :

- vérifier la signature ;
- utiliser l'idempotence ;
- ne jamais faire confiance aveuglément au provider ;
- rattacher l'événement à un objet du domaine ;
- auditer les changements importants.

## Pagination et filtres

Les listes doivent supporter une pagination simple.

Paramètres candidats :

- `limit`
- `cursor`
- `sort`

Éviter les recherches trop puissantes au MVP.

L'objectif est de servir le suivi mensuel des loyers, pas de construire un moteur analytique.

## Validation des entrées

Chaque endpoint de mutation doit valider :

- types ;
- champs requis ;
- longueurs de texte ;
- montants positifs ;
- devises autorisées ;
- dates cohérentes ;
- statuts autorisés ;
- appartenance au propriétaire courant ;
- cohérence entre objets liés.

## Sécurité minimale

L'API doit garantir :

- authentification sur toutes les routes privées ;
- autorisation côté serveur ;
- filtrage par `landlord_id` ;
- validation des entrées ;
- rate limiting sur endpoints sensibles ;
- protection des fichiers ;
- liens publics limités ;
- audit logs sur actions sensibles ;
- absence de données sensibles dans les erreurs ;
- absence de secrets dans les réponses.

## Ordre recommandé d'implémentation API

1. `GET /api/me`
2. `POST /api/onboarding/landlord`
3. Propriétés
4. Logements
5. Locataires
6. Baux
7. Génération d'échéances
8. Liste et détail des échéances
9. Encaissements
10. Allocations d'encaissement
11. Confirmation d'encaissement
12. Preuves de paiement
13. Reçus
14. Relances
15. Liens publics contrôlés
16. Audit logs minimum

## Règles non négociables

1. Aucune route privée ne doit retourner les données d'un autre propriétaire.
2. Aucune mutation sensible ne doit contourner l'audit log.
3. Aucun reçu ne doit être généré sans encaissement confirmé.
4. Aucune relance ne doit être créée sans échéance.
5. Aucun fichier sensible ne doit être exposé publiquement sans contrôle.
6. Aucun prestataire externe ne doit décider du statut métier final sans validation Ranti.
7. Aucun changement d'état critique ne doit être fait par simple `PATCH status` non contrôlé.
8. Aucune règle métier critique ne doit exister uniquement côté interface.

## Phrase de contrôle

L'API de Ranti doit agir comme un gardien du cahier de loyers.

Elle accepte uniquement les actions qui gardent la mémoire des loyers claire, traçable et fiable.

Si une route permet de créer de la confusion sur qui a payé, qui est en retard ou quelle preuve existe, elle doit être corrigée ou supprimée.
