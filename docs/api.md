# Ranti — API

## Status

Version 2.0 — refactoring autour de l'architecture domaine.

Ce document définit l'architecture API de Ranti.

Il n'est pas une spécification OpenAPI. Il n'engage pas les détails de payload.

Il définit les use cases serveur, les responsabilités par module, les règles métier applicables et les contraintes techniques transverses.

## Purpose

L'API de Ranti doit permettre au propriétaire de répondre à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque paiement ?

L'API n'est pas une couche CRUD.

Elle applique les règles métier, contrôle les permissions, protège les données sensibles, trace les actions sensibles et empêche les transitions invalides.

## API Principles

**Le serveur décide.**
L'interface peut proposer une action. Le serveur vérifie l'identité, le périmètre, les permissions, la cohérence des objets et les transitions métier.

**Une action métier = un endpoint.**
Les transitions importantes ne passent pas par un `PATCH status` libre. Elles passent par un endpoint explicite qui encode l'intention.

**Les mutations sensibles sont auditées.**
Création de bail, génération d'échéances, encaissement, confirmation, reçu, relance — chacune produit un log d'audit.

**Les lectures sont filtrées par propriétaire.**
Aucun objet d'un autre propriétaire ne peut être retourné, même si l'identifiant est connu. Une ressource hors périmètre retourne `404`.

**Les prestataires externes sont des adaptateurs.**
WhatsApp, SMS, PDF, stockage, paiement — aucun prestataire ne décide du statut métier final.

**REST pragmatique.**
`GET` pour lire, `POST` pour créer ou déclencher une action, `PATCH` pour modifier partiellement, `DELETE` uniquement pour les suppressions logiques contrôlées.

---

## Authentication

### Responsibility

Identifier les utilisateurs, résoudre le contexte courant et initialiser l'espace propriétaire.

### Business Use Cases

- Résoudre l'identité et le contexte courant.
- Créer l'espace propriétaire initial.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/me` | Résoudre l'utilisateur courant, son propriétaire et ses permissions |
| `POST` | `/api/onboarding/landlord` | Créer l'espace propriétaire initial |

### Business Rules

- `GET /api/me` retourne l'identité, le `landlord` courant, le rôle et les permissions.
- `POST /api/onboarding/landlord` est réservé à un utilisateur sans espace propriétaire existant au MVP.
- L'onboarding est audité.

### Technical Constraints

- Rôle MVP principal : `landlord_owner`.
- Rôles candidats futurs : `tenant_link_user`, `admin`, `system`.
- Toute route privée exige une session valide. Absence de session → `401`.

---

## Landlords

### Responsibility

Représenter le propriétaire dans Ranti. Toutes les données métier lui sont rattachées.

### Business Use Cases

- Consulter et modifier le profil propriétaire.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/landlords/me` | Consulter le profil du propriétaire courant |
| `PATCH` | `/api/landlords/me` | Modifier les informations du propriétaire courant |

### Business Rules

- Un propriétaire ne peut accéder qu'à son propre espace.
- Les modifications importantes sont auditées.

### Technical Constraints

- Le `landlord_id` est résolu depuis la session, jamais depuis un paramètre URL exposé au MVP.

---

## Properties

### Responsibility

Représenter les lieux physiques appartenant au propriétaire.

### Business Use Cases

- Créer, consulter, modifier et archiver une propriété.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/properties` | Lister les propriétés du propriétaire courant |
| `POST` | `/api/properties` | Créer une propriété |
| `GET` | `/api/properties/{id}` | Consulter une propriété |
| `PATCH` | `/api/properties/{id}` | Modifier une propriété |
| `POST` | `/api/properties/{id}/archive` | Archiver une propriété |

### Business Rules

- Une propriété est automatiquement rattachée au propriétaire courant à la création.
- L'archivage ne supprime pas les logements, baux ou historiques associés.
- Les modifications importantes sont auditées.

### Technical Constraints

- Filtres candidats : `status`, `city`.

---

## Units

### Responsibility

Représenter les espaces louables situés dans une propriété.

### Business Use Cases

- Créer, consulter, modifier et archiver un logement.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/units` | Lister les logements du propriétaire courant |
| `POST` | `/api/units` | Créer un logement |
| `GET` | `/api/units/{id}` | Consulter un logement |
| `PATCH` | `/api/units/{id}` | Modifier un logement |
| `POST` | `/api/units/{id}/archive` | Archiver un logement |

### Business Rules

- La propriété parente doit appartenir au propriétaire courant.
- Le logement hérite du `landlord_id`.
- Un logement avec bail actif ne peut pas être supprimé physiquement.
- L'archivage est audité.

### Technical Constraints

- Filtres candidats : `property_id`, `status`, `unit_type`.

---

## Tenants

### Responsibility

Représenter les locataires rattachés au propriétaire.

### Business Use Cases

- Créer, consulter, modifier et archiver un locataire.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/tenants` | Lister les locataires du propriétaire courant |
| `POST` | `/api/tenants` | Créer un locataire |
| `GET` | `/api/tenants/{id}` | Consulter un locataire |
| `PATCH` | `/api/tenants/{id}` | Modifier un locataire |
| `POST` | `/api/tenants/{id}/archive` | Archiver un locataire |

### Business Rules

- L'unicité globale du numéro de téléphone n'est pas imposée au MVP.
- Le locataire est rattaché au propriétaire courant.
- L'archivage ne supprime pas l'historique.
- Les actions sont auditées.

### Technical Constraints

- Filtres candidats : `status`, `search`.

---

## Leases

### Responsibility

Représenter les baux ou accords locatifs. Le bail est la source des règles de génération des échéances.

### Business Use Cases

- Créer un bail.
- Activer un bail.
- Terminer un bail.
- Consulter et modifier un bail.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/leases` | Lister les baux du propriétaire courant |
| `POST` | `/api/leases` | Créer un bail |
| `GET` | `/api/leases/{id}` | Consulter un bail |
| `PATCH` | `/api/leases/{id}` | Modifier un bail |
| `POST` | `/api/leases/{id}/activate` | Activer un bail |
| `POST` | `/api/leases/{id}/end` | Terminer un bail |

### Business Rules

- Le logement et le locataire doivent appartenir au propriétaire courant.
- Deux baux actifs ne peuvent pas couvrir le même logement sur la même période.
- `rent_amount` doit être positif.
- `billing_period` est `monthly` au MVP.
- L'activation peut déclencher la génération initiale des échéances.
- La terminaison conserve l'historique (échéances, encaissements, preuves, reçus).
- Les modifications d'un bail avec des échéances existantes sont contraintes.
- Toute action de transition est transactionnelle et auditée.

### Technical Constraints

- Filtres candidats : `status`, `unit_id`, `tenant_id`.

---

## Rent Schedules

### Responsibility

Représenter les obligations de paiement mensuelles. C'est le module central du MVP.

Une échéance naît d'un bail. Elle trace ce qui est dû, ce qui est encaissé et ce qui reste à régler.

### Business Use Cases

- Générer les échéances d'un bail.
- Consulter les échéances et leur statut.
- Obtenir une synthèse du tableau de bord mensuel.
- Annuler une échéance avec trace.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/rent-dues` | Lister les échéances du propriétaire courant |
| `GET` | `/api/rent-dues/summary` | Synthèse : dues, en retard, encaissées, restant dû |
| `GET` | `/api/rent-dues/{id}` | Consulter une échéance avec ses encaissements, preuves et reçus |
| `POST` | `/api/leases/{id}/rent-dues/generate` | Générer les échéances d'un bail |
| `POST` | `/api/rent-dues/{id}/cancel` | Annuler une échéance avec trace |

### Business Rules

- Une échéance naît uniquement d'un bail actif ou compatible.
- L'unicité `(lease_id, period_start, period_end)` est enforced — pas de double génération.
- L'annulation ne supprime pas physiquement l'échéance.
- L'annulation est refusée si des encaissements confirmés la rendent incohérente, sauf flux de correction dédié.
- `GET /api/rent-dues/summary` répond uniquement aux trois questions du MVP (payé, en retard, action requise). Ce n'est pas un dashboard analytique.
- La génération est transactionnelle et auditée.

**Statuts valides :**
`upcoming` → `due` → `partially_collected` / `collected` / `overdue` / `cancelled` / `disputed`

### Technical Constraints

- Filtres candidats : `status`, `tenant_id`, `unit_id`, `lease_id`, `from`, `to`.

---

## Rent Receptions

### Responsibility

Représenter les encaissements du point de vue du propriétaire.

Un encaissement peut régler une ou plusieurs échéances. Une échéance peut recevoir plusieurs encaissements.

Le module ne dépend d'aucun prestataire de paiement. Un encaissement peut venir du cash, du Mobile Money, d'un virement ou d'une déclaration manuelle.

### Business Use Cases

- Enregistrer un encaissement avec ses allocations.
- Confirmer un encaissement (validation humaine).
- Annuler un encaissement avec trace.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/collections` | Lister les encaissements du propriétaire courant |
| `POST` | `/api/collections` | Enregistrer un encaissement |
| `GET` | `/api/collections/{id}` | Consulter un encaissement |
| `POST` | `/api/collections/{id}/confirm` | Confirmer un encaissement |
| `POST` | `/api/collections/{id}/cancel` | Annuler un encaissement |

### Business Rules

- Le locataire et chaque échéance allouée doivent appartenir au propriétaire courant.
- Le montant doit être positif.
- La somme des allocations ne peut pas dépasser le montant encaissé.
- La confirmation met à jour les montants dérivés et les statuts des échéances concernées.
- L'annulation est refusée si un reçu a déjà été généré, sauf flux de correction explicite.
- L'annulation recalcule les échéances concernées.
- Toute action est transactionnelle et auditée.

**Statuts valides :**
`draft` → `pending_confirmation` → `confirmed` / `cancelled` / `reversed`

### Technical Constraints

- Filtres candidats : `tenant_id`, `status`, `method`, `from`, `to`.
- `Idempotency-Key` recommandé sur `POST /api/collections` et `POST /api/collections/{id}/confirm`.

---

## Proofs

### Responsibility

Conserver les preuves de paiement (captures Mobile Money, reçus bancaires, photos).

Les preuves sont sensibles et ne sont jamais publiques sans contrôle.

### Business Use Cases

- Préparer un upload sécurisé.
- Attacher une preuve à un encaissement ou une échéance.
- Consulter les métadonnées d'une preuve.
- Archiver une preuve.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `POST` | `/api/payment-proofs/upload-url` | Obtenir une URL d'upload sécurisé |
| `POST` | `/api/payment-proofs` | Attacher une preuve après upload |
| `GET` | `/api/payment-proofs/{id}` | Consulter les métadonnées d'une preuve |
| `POST` | `/api/payment-proofs/{id}/archive` | Archiver une preuve |

### Business Rules

- Une preuve doit être liée à une échéance, un encaissement ou les deux.
- Le type et la taille du fichier sont contrôlés à l'upload.
- Le fichier n'est pas rendu public sans mécanisme de lien contrôlé.
- L'ajout et l'archivage sont audités.

### Technical Constraints

- L'URL d'upload est générée côté serveur et liée à un accès vérifié.
- Le stockage reste derrière un adaptateur.

---

## Receipts

### Responsibility

Générer et conserver les quittances.

Un reçu est déterministe : il est généré à partir de données confirmées et ne peut pas être modifié silencieusement.

### Business Use Cases

- Générer un reçu à partir d'encaissements confirmés.
- Consulter un reçu.
- Créer un lien de partage contrôlé.
- Annuler un reçu avec trace.
- Révoquer un lien de partage.
- Résoudre un lien public contrôlé.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/receipts` | Lister les reçus du propriétaire courant |
| `POST` | `/api/receipts` | Générer un reçu |
| `GET` | `/api/receipts/{id}` | Consulter un reçu |
| `POST` | `/api/receipts/{id}/share-link` | Créer un lien de partage contrôlé |
| `POST` | `/api/receipts/{id}/share-link/{link_id}/revoke` | Révoquer un lien de partage |
| `POST` | `/api/receipts/{id}/cancel` | Annuler un reçu avec trace |
| `GET` | `/p/{token}` | Résoudre un lien public contrôlé (lecture seule) |

### Business Rules

- Un reçu ne peut pas être généré sans encaissement confirmé.
- Les encaissements et échéances référencés doivent appartenir au propriétaire courant.
- Un numéro de reçu unique par propriétaire est généré.
- Un snapshot des données utilisées est créé à la génération.
- Un reçu généré ne peut pas être modifié silencieusement. Toute correction nécessite une trace ou un flux `replaced`.
- L'annulation ne supprime pas physiquement le reçu.
- Le lien de partage est limité à la consultation du reçu. Le token est stocké haché, jamais en clair.
- Le lien public vérifie l'expiration et la révocation avant tout accès.
- La génération est transactionnelle et auditée.

### Technical Constraints

- Filtres candidats : `tenant_id`, `lease_id`, `from`, `to`, `status`.
- La génération PDF passe par un adaptateur externe.
- `Idempotency-Key` recommandé sur `POST /api/receipts`.

---

## Reminders

### Responsibility

Représenter et envoyer les relances pour les échéances impayées ou en retard.

La relance doit exister dans Ranti avant ou pendant l'envoi. Le canal externe est un adaptateur.

### Business Use Cases

- Créer une relance liée à une échéance.
- Envoyer une relance via un canal externe.

### Endpoints

| Méthode | Path | Use Case |
|---------|------|----------|
| `GET` | `/api/reminders` | Lister les relances du propriétaire courant |
| `POST` | `/api/reminders` | Créer une relance |
| `POST` | `/api/reminders/{id}/send` | Envoyer une relance via canal externe |

### Business Rules

- Une relance doit être liée à une échéance du propriétaire courant.
- Une relance sans échéance est refusée.
- L'envoi crée une tentative dans `notification_deliveries`.
- L'échec d'envoi ne supprime pas la relance ni son historique.
- La création et l'envoi sont audités.

### Technical Constraints

- Filtres candidats : `rent_due_id`, `tenant_id`, `channel`, `status`.
- Le canal (`whatsapp`, `sms`) est résolu par un adaptateur.

---

## Cross-cutting Concerns

### Authentication

Chaque requête authentifiée résout : `current_user`, `current_landlord`, rôle courant, permissions applicables.

Toute route privée sans session valide retourne `401`.

### Authorization

L'autorisation est vérifiée côté serveur sur chaque mutation et chaque lecture.

Un propriétaire ne peut jamais accéder aux données d'un autre propriétaire.

Une ressource hors périmètre retourne `404` (pas `403`) pour éviter les fuites d'information.

### Validation

Chaque endpoint de mutation valide : types et champs requis, longueurs de texte, montants positifs, devises autorisées (`XOF` au MVP), dates cohérentes, statuts valides, appartenance au propriétaire courant, cohérence entre objets liés.

### Transactions

Les actions qui modifient plusieurs tables doivent être transactionnelles :

- créer un bail et générer ses échéances ;
- confirmer un encaissement et mettre à jour les échéances ;
- générer un reçu et ses lignes ;
- créer une relance et enregistrer une tentative de notification.

### Audit

Actions qui produisent un log d'audit sans exception :

- création d'un espace propriétaire
- création ou modification d'une propriété, d'un logement, d'un locataire
- création, activation ou terminaison d'un bail
- génération d'une échéance
- enregistrement, confirmation ou annulation d'un encaissement
- ajout ou archivage d'une preuve
- génération ou annulation d'un reçu
- création ou envoi d'une relance
- création ou révocation d'un lien de partage

Le log d'audit est en écriture seule via l'API standard.

### Idempotency

Header : `Idempotency-Key`

Endpoints concernés : `POST /api/collections`, `POST /api/collections/{id}/confirm`, `POST /api/receipts`, `POST /api/reminders/{id}/send`, webhooks futurs de paiement.

### Pagination

Les listes supportent une pagination curseur simple.

Paramètres candidats : `limit`, `cursor`, `sort`.

Les recherches complexes et l'analytique avancée sont exclues du MVP.

### Errors

**Format réponse réussie :**
`{ "data": {}, "meta": {} }` — `meta` optionnel (pagination, filtres, avertissements).

**Format erreur :**
`{ "error": { "code": "string", "message": "string", "details": {} } }` — pas d'information sensible dans `details`.

**Codes HTTP :**

| Code | Signification |
|------|---------------|
| `200` | Lecture ou action réussie |
| `201` | Ressource créée |
| `400` | Entrée invalide |
| `401` | Non authentifié |
| `403` | Authentifié mais non autorisé |
| `404` | Ressource inexistante ou hors périmètre |
| `409` | Conflit métier ou transition impossible |
| `422` | Données valides techniquement mais invalides métier |
| `429` | Limite de requêtes dépassée |
| `500` | Erreur serveur inattendue |

**Codes d'erreur métier candidats :**

`AUTH_REQUIRED` · `ACCESS_DENIED` · `RESOURCE_NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_STATE_TRANSITION` · `LANDLORD_MISMATCH` · `LEASE_ALREADY_ACTIVE` · `UNIT_ALREADY_OCCUPIED` · `RENT_DUE_ALREADY_EXISTS` · `COLLECTION_AMOUNT_INVALID` · `COLLECTION_ALREADY_CONFIRMED` · `COLLECTION_NOT_CONFIRMED` · `ALLOCATION_EXCEEDS_COLLECTION` · `RECEIPT_REQUIRES_CONFIRMED_COLLECTION` · `REMINDER_REQUIRES_RENT_DUE` · `PUBLIC_LINK_EXPIRED` · `PUBLIC_LINK_REVOKED` · `RATE_LIMITED`

---

## MVP Scope

**Périmètre inclus :** tous les modules ci-dessus.

**Ordre de construction recommandé :**

1. `GET /api/me` + `POST /api/onboarding/landlord`
2. Properties
3. Units
4. Tenants
5. Leases
6. `POST /api/leases/{id}/rent-dues/generate` + `GET /api/rent-dues`
7. Rent Receptions (enregistrement + confirmation)
8. Proofs
9. Receipts
10. Reminders

`audit_logs` est pensé dès le début et implémenté progressivement. Les actions critiques ne restent jamais sans trace.

**Invariants non négociables :**

1. Aucune route privée ne retourne les données d'un autre propriétaire.
2. Aucune mutation sensible ne contourne le log d'audit.
3. Aucun reçu n'est généré sans encaissement confirmé.
4. Aucune relance n'est créée sans échéance.
5. Aucun fichier sensible n'est exposé publiquement sans contrôle.
6. Aucun prestataire externe ne décide du statut métier final.
7. Aucun changement d'état critique ne passe par un `PATCH status` libre.
8. Aucune règle métier critique ne vit uniquement côté interface.

---

## Post-MVP Scope

**Fonctionnalités reportées :**

- Gestion complète des agences et équipes
- Rôles granulaires (`gestionnaire`, `comptable`, `viewer`)
- Espace locataire (consultation, upload de preuve, signature)
- Webhooks entrants (paiement Mobile Money, statut SMS/WhatsApp)
- Rapprochement bancaire automatique
- Génération PDF asynchrone avancée
- Scoring locataire
- Comptabilité et facturation Ranti avancées
- Analytics et rapports avancés
- Multi-pays et multi-devises
- Marketplace

**Webhooks futurs (règles à respecter lors de l'implémentation) :**

- Vérifier la signature du provider.
- Utiliser l'idempotence.
- Ne jamais faire confiance au statut du provider sans validation Ranti.
- Rattacher l'événement à un objet du domaine.
- Auditer les changements importants.

---

## Control Phrase

L'API de Ranti agit comme le gardien du cahier de loyers.

Elle accepte uniquement les actions qui maintiennent la mémoire des loyers claire, traçable et fiable.

Si une route permet de créer de la confusion sur qui a payé, qui est en retard ou quelle preuve existe, elle doit être corrigée ou supprimée.
