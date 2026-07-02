# Ranti — API Conventions

## Statut

Version 3.0 — document de conventions, pas une spécification OpenAPI.

## Rôle du document

Ce fichier ne liste pas tous les endpoints de manière détaillée.

Il définit les conventions API de Ranti : responsabilités serveur, formats de réponse, règles de mutation, sécurité, idempotence, audit et limites MVP.

Les détails métier vivent dans :

- `docs/domain-model.md`
- `docs/database.md`
- `docs/implementation-plan-reminder-proof-engines.md`
- `docs/decisions/`

## Principe général

L'API n'est pas une couche CRUD.

Elle doit protéger l'histoire métier suivante :

> Ce propriétaire a ce logement. Ce locataire l'occupe selon ce bail. Pour ce mois, cette échéance était attendue. Ranti savait quoi rappeler. Voici ce qui a été reçu et validé. Voici le reçu ou la quittance généré. Voici la relance prévue ou envoyée. Voici l'historique des actions.

Si une route ne protège pas cette histoire, elle doit être corrigée ou retirée du MVP.

## Questions auxquelles l'API doit répondre

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque loyer reçu ?
4. Quelle relance est prévue, préparée ou envoyée ?
5. Quel reçu ou quelle quittance a été généré après validation ?

## Product Engines

### Reminder Engine

Le bail crée les échéances. Les échéances créent les rappels et relances.

Le propriétaire configure les règles. Ranti prépare, planifie ou envoie selon le niveau d'automatisation disponible.

### Proof Engine

Le paiement validé crée la preuve.

Après validation d'une réception de loyer par le propriétaire, Ranti génère automatiquement le document adapté : reçu de paiement partiel, reçu complet ou quittance.

## Responsabilités serveur

Le serveur doit toujours vérifier :

- l'utilisateur courant ;
- le propriétaire courant ;
- l'appartenance des ressources au propriétaire ;
- la cohérence des objets liés ;
- les transitions métier autorisées ;
- les montants, dates, statuts et devises ;
- les règles d'audit ;
- l'idempotence des actions sensibles.

L'interface peut proposer une action. Le serveur décide si elle est valide.

## Format de réponse

### Succès

```json
{
  "data": {},
  "meta": {}
}
```

`meta` est optionnel. Il peut contenir pagination, filtres appliqués, avertissements ou informations de génération.

### Erreur

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message lisible par l'utilisateur ou le support.",
    "details": {}
  }
}
```

`details` ne doit jamais exposer de donnée sensible.

## Codes HTTP

| Code | Usage |
|---|---|
| `200` | lecture ou action réussie |
| `201` | ressource créée |
| `400` | entrée invalide |
| `401` | non authentifié |
| `403` | authentifié mais non autorisé |
| `404` | ressource inexistante ou hors périmètre |
| `409` | conflit métier ou transition impossible |
| `422` | données valides techniquement mais invalides métier |
| `429` | limite de requêtes dépassée |
| `500` | erreur serveur inattendue |

## Codes métier candidats

```txt
AUTH_REQUIRED
ACCESS_DENIED
RESOURCE_NOT_FOUND
VALIDATION_ERROR
INVALID_STATE_TRANSITION
LANDLORD_MISMATCH
LEASE_ALREADY_ACTIVE
UNIT_ALREADY_OCCUPIED
RENT_DUE_ALREADY_EXISTS
REMINDER_RULE_INVALID
REMINDER_ALREADY_EXISTS
REMINDER_CHANNEL_UNAVAILABLE
RECEPTION_AMOUNT_INVALID
RECEPTION_ALREADY_CONFIRMED
RECEIPT_ALREADY_EXISTS
DOCUMENT_GENERATION_FAILED
RECEIPT_CORRECTION_REQUIRED
```

## Conventions de routes

### Lecture

Utiliser `GET` pour lire.

Exemples de familles :

```txt
GET /api/me
GET /api/properties
GET /api/units
GET /api/tenants
GET /api/leases
GET /api/rent-dues
GET /api/rent-receptions
GET /api/receipts
GET /api/reminders
GET /api/dashboard/monthly
```

### Création simple

Utiliser `POST` sur la collection.

```txt
POST /api/properties
POST /api/units
POST /api/tenants
POST /api/leases
POST /api/rent-receptions
```

### Modification simple

Utiliser `PATCH` quand il s'agit d'une modification partielle sans transition métier sensible.

```txt
PATCH /api/properties/{id}
PATCH /api/units/{id}
PATCH /api/tenants/{id}
PATCH /api/leases/{id}
```

### Transitions métier

Utiliser `POST` avec un verbe métier explicite.

```txt
POST /api/leases/{id}/activate
POST /api/leases/{id}/end
POST /api/rent-dues/{id}/cancel
POST /api/rent-receptions/{id}/confirm
POST /api/rent-receptions/{id}/cancel
POST /api/receipts/{id}/cancel
POST /api/receipts/{id}/replace
POST /api/reminders/{id}/cancel
POST /api/reminders/{id}/queue
POST /api/reminders/{id}/send
```

Ne pas exposer de `PATCH status` libre pour les transitions sensibles.

## Endpoints moteur — cible produit

Ces routes sont des cibles de conception. Elles ne doivent être implémentées qu'après gap analysis code + DB.

### Reminder Engine

```txt
GET  /api/leases/{id}/reminder-rules
POST /api/leases/{id}/reminder-rules
PATCH /api/reminder-rules/{id}
POST /api/reminder-rules/{id}/activate
POST /api/reminder-rules/{id}/deactivate
POST /api/leases/{id}/reminders/generate
POST /api/reminders/generate-due
```

### Proof Engine

```txt
POST /api/rent-receptions/{id}/confirm
POST /api/rent-receptions/{id}/documents/generate
POST /api/receipts/{id}/replace
```

Règle produit : le flux principal est `confirm payment -> generate document automatically`.

`/documents/generate` est un fallback technique, pas le parcours utilisateur principal.

## Idempotence

Les actions suivantes doivent être idempotentes ou protégées contre le double clic, les retries et les webhooks répétés :

- génération d'échéances ;
- génération de relances ;
- mise en file ou envoi de relance ;
- création de réception de loyer ;
- confirmation de réception de loyer ;
- génération automatique de reçu/quittance ;
- remplacement de reçu/quittance ;
- webhooks futurs de paiement.

Convention : utiliser `Idempotency-Key` quand l'action peut être rejouée par le client ou un prestataire.

## Transactions

Les actions suivantes doivent être transactionnelles ou garantir une cohérence équivalente :

- créer un bail et générer ses échéances ;
- créer ou modifier une règle de rappel ;
- générer les relances prévues ;
- confirmer une réception de loyer ;
- mettre à jour les échéances après paiement ;
- générer automatiquement un reçu ou une quittance ;
- annuler ou remplacer un document ;
- mettre en file ou envoyer une relance.

## Audit

Les actions suivantes doivent produire un audit log :

- onboarding propriétaire ;
- création, modification ou archivage propriété/logement/locataire ;
- création, activation ou fin de bail ;
- création, modification, activation ou désactivation règle de rappel ;
- génération d'échéance ;
- marquage overdue ;
- création, mise en file, envoi ou annulation relance ;
- enregistrement, confirmation ou annulation réception de loyer ;
- génération, annulation ou remplacement reçu/quittance ;
- ajout ou archivage de preuve.

## Sécurité

Chaque requête privée résout :

```txt
current_user
current_landlord
role
permissions
```

Un propriétaire ne peut jamais accéder aux données d'un autre propriétaire.

Une ressource hors périmètre retourne `404`, pas `403`, pour éviter les fuites d'information.

Les fichiers sensibles ne sont jamais publics sans lien contrôlé.

## Prestataires externes

WhatsApp, SMS, PDF, stockage et paiements sont des adaptateurs.

Ils ne décident jamais :

- qu'un paiement est confirmé ;
- qu'une échéance est payée ;
- qu'une relance est due ;
- qu'un reçu ou une quittance est valide.

Le domaine métier reste propriétaire de la vérité.

## Pagination

Les listes utilisent une pagination simple par curseur.

```txt
limit
cursor
sort
```

Les recherches complexes et analytics avancés sont exclus du MVP.

## MVP Guardrails

L'API doit refuser ou reporter :

- marketplace ;
- CRM immobilier ;
- portail locataire complet ;
- comptabilité avancée ;
- paiement en ligne obligatoire ;
- wallet Ranti ;
- envoi automatique externe non maîtrisé ;
- recouvrement agressif ;
- analytics avancés ;
- suppression silencieuse de données financières ou preuves.

## Quand créer une vraie spec endpoint ?

Créer un fichier séparé seulement quand l'endpoint est prêt à être implémenté.

Format recommandé :

```txt
docs/api/<module>/<action>.md
```

Exemples :

```txt
docs/api/rent-receptions/confirm.md
docs/api/reminders/generate-due.md
docs/api/receipts/replace.md
```

Chaque vraie spec doit contenir :

- objectif ;
- préconditions ;
- payload request ;
- response success ;
- response errors ;
- règles métier ;
- effets transactionnels ;
- audit logs ;
- idempotence ;
- tests d'acceptation.
