# Ranti — API Conventions

## Statut

Version 3.1 (2026-08-09) — document de conventions, pas une spécification
OpenAPI. Mise à jour pour le pivot entreprises de gestion (ADR-029) et le
retrait du rail de paiement (ADR-030) : le webhook PSP et tout ce qui dépendait
de `payment_transactions` sont supprimés ; les RPC de portefeuille, de clôture
et de relance par lot sont documentées ci-dessous.

Le titulaire du compte est l'entreprise de gestion. Le terme « propriétaire »
employé dans ce document désigne le compte connecté (`landlords`) ; le
propriétaire mandant, qui n'a pas de compte, est nommé « mandant ».

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

### Création groupée (onboarding portefeuille)

Depuis ADR-029, l'entrée d'une agence dans le produit se fait par fichier
(`validate_portfolio_import` puis `import_portfolio`, voir « RPC Postgres
exposées »). La création groupée décrite ci-dessous reste en place pour le
portefeuille saisi à la main, propriété par propriété.

Un compte qui gère plusieurs logements doit pouvoir en enregistrer plusieurs
d'un seul geste, chacun optionnellement avec son locataire et son bail activé —
sans repasser par le wizard unitaire logement par logement.

Implémentation MVP : RPC Postgres `bulk_onboard_portfolio(p_property_id, p_rows)`
(SECURITY INVOKER, réutilise `activate_lease`/`generate_rent_dues`). Chaque ligne
de `p_rows` crée un logement ; si la ligne porte un bloc locataire, elle crée aussi
le locataire, le bail (`draft`) puis l'active (échéances générées, ADR-004). Sinon
le logement est créé vacant.

Règles :

- Opération **atomique tout-ou-rien** : toute ligne en échec (nom de logement
  dupliqué, chevauchement de bail, données invalides) annule l'intégralité du lot.
- Aucune règle métier propre : réutilise les validations et invariants des créations
  unitaires (logement, locataire, bail) et la génération d'échéances existante.
- Portée MVP : une propriété par lot ; type de logement et jour d'échéance partagés
  en entête ; loyer et date de début par ligne.

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

## RPC Postgres exposées

Une partie des actions sensibles est implémentée en RPC Postgres appelées par
l'application via PostgREST (`supabase.rpc(...)`), sans route HTTP propre. Ces
fonctions sont soumises aux mêmes règles que les routes : appartenance vérifiée
côté serveur, transitions métier contrôlées, audit.

Convention de sécurité : `SECURITY INVOKER` quand la RLS suffit à borner
l'appelant, `SECURITY DEFINER` quand la fonction doit lire ou écrire au-delà de
ce que la RLS accorde au client. Toutes commencent par
`private.current_landlord_id()` et lèvent `landlord_not_found` (`P0002`) si le
compte n'est pas résolu. Aucune n'est exécutable par `anon`, sauf mention
contraire.

### Import de portefeuille (ADR-029)

```txt
validate_portfolio_import(p_rows jsonb)
  -> table (line integer, unit_label text, errors text[])

import_portfolio(p_rows jsonb, p_request_id uuid default null)
  -> jsonb
```

Parcours en deux temps. `validate_portfolio_import` n'écrit rien : elle rend un
verdict ligne par ligne (champs manquants, type de lot inconnu, taux
d'honoraires hors bornes, date hors format `AAAA-MM-JJ`, doublon interne au
fichier, lot déjà présent au portefeuille). Un lot vacant sans locataire est une
ligne valide. L'agence corrige son fichier et rejoue.

`import_portfolio` refuse de commencer si la validation renvoie une seule
erreur, puis exécute en tout-ou-rien : mandants et biens rapprochés par nom
(insensible à la casse et aux espaces), lots créés, locataires et baux créés
puis activés par `activate_lease` (génération des échéances, ADR-004).

- Idempotence : `p_request_id`, scope `import_portfolio` d'`idempotency_keys`.
  Un rejeu renvoie le résultat du premier appel ; un appel concurrent encore en
  cours lève `import_in_progress`.
- Erreurs : `no_rows`, `validation_failed: <détail par ligne>`,
  `ligne <n>: <message>` pour une erreur d'insertion.
- Retour : `{ owners_created, properties_created, units_created,
  tenants_created, leases_activated, rent_dues_generated }`.
- Surface : `/import`, couche `src/lib/import/`.

### Relevé du mandant et clôture (ADR-029)

```txt
owner_statement_lines(p_owner_id uuid, p_month date)
  -> table (unit_id, property_name, unit_name, tenant_name, lease_id,
            expected, collected, fee, net, fee_rate_bp)

owner_statement(p_owner_id uuid, p_month date)
  -> jsonb
```

`owner_statement_lines` rend une ligne par lot du mandant, y compris les lots
sans encaissement du mois (valeurs à zéro). `encaissé` compte les allocations
d'encaissements confirmés dont la date de réception tombe dans le mois ;
`honoraires = floor(encaissé × fee_rate_bp / 10000)` est calculé ligne par
ligne ; `net = encaissé − honoraires`. Un lot archivé n'est retiré qu'à partir
du mois de son archivage, pour qu'un relevé déjà remis se reproduise à
l'identique.

`owner_statement` compose le document complet : bloc mandant, bloc agence,
période, lignes, et totaux (`expected`, `collected`, `fee`, `net_due_to_owner`,
`outstanding`). Les totaux sont la somme des lignes.

- Erreurs : `owner_not_found` (`P0002`) — mandant inconnu ou hors portefeuille ;
  l'application répond 404.
- Surface : `/cloture`, `/cloture/[ownerId]`, `/cloture/[ownerId]/pdf`, couche
  `src/lib/statements/`.

### Relance par lot (ADR-029)

```txt
log_reminder_batch(p_rent_due_ids uuid[], p_messages jsonb default '{}')
  -> jsonb
```

Enregistre en un appel la trace d'un lot de relances : une ligne
`reminder_events` par échéance (`channel = 'whatsapp_manual'`, `status =
'sent'`, `sent_by = 'landlord'`), et mise à jour de `last_reminder_at` /
`reminder_count` sur `rent_dues`. `p_messages` associe le texte envoyé à
l'identifiant d'échéance ; une entrée absente enregistre une trace vide plutôt
qu'un échec.

Ranti n'envoie rien : le message part du WhatsApp du gestionnaire par lien
`wa.me`. La file à relancer se lit dans la vue `reminder_batch`.

- Garde : lot borné à 500 échéances (`batch_too_large`) ; seules les échéances
  du portefeuille de l'appelant sont journalisées, les autres sont ignorées
  silencieusement.
- Retour : `{ logged: n }`.
- Surface : `/reminders/batch`, `src/lib/reminders/batch.ts`.

### Lien de partage d'une quittance (ADR-030, durcissement du sceau)

```txt
receipt_share_token(p_receipt_id uuid) -> uuid
```

Le jeton locataire d'une quittance n'est plus lisible en colonne : le privilège
`SELECT (tenant_token)` est retiré à `authenticated`. Le gestionnaire l'obtient
par cette RPC, qui vérifie l'appartenance et écrit
`receipt.share_link_issued` dans `audit_logs`. Une certification apposée sans
qu'aucun lien n'ait été demandé pour la quittance devient une anomalie
repérable.

- Erreurs : `receipt_not_found` (`P0002`).
- Surface : `src/lib/receipts/queries.ts`.

## Idempotence

Les actions suivantes doivent être idempotentes ou protégées contre le double clic, les retries et les webhooks répétés :

- génération d'échéances ;
- génération de relances ;
- mise en file ou envoi de relance ;
- création de réception de loyer ;
- confirmation de réception de loyer ;
- génération automatique de reçu/quittance ;
- remplacement de reçu/quittance ;
- import de portefeuille (`import_portfolio`).

Convention : utiliser `Idempotency-Key` quand l'action peut être rejouée par le
client. Côté base, l'idempotence des écritures groupées passe par la table
`idempotency_keys` (`scope` ∈ `record_collection`, `bulk_onboard`,
`import_portfolio`) : un rejeu avec la même clé renvoie le résultat archivé du
premier appel au lieu de réécrire.

Aucun prestataire de paiement n'appelle Ranti. Le webhook PSP
`POST /api/payments/notification` est supprimé (ADR-030), ainsi que le ledger
`payment_transactions` qui portait son idempotence.

## Transactions

Les actions suivantes doivent être transactionnelles ou garantir une cohérence équivalente :

- créer un bail et générer ses échéances ;
- créer un lot de logements/locataires/baux (onboarding groupé, atomique) ;
- créer ou modifier une règle de rappel ;
- générer les relances prévues ;
- confirmer une réception de loyer ;
- mettre à jour les échéances après paiement ;
- générer automatiquement un reçu ou une quittance ;
- annuler ou remplacer un document ;
- mettre en file ou envoyer une relance.

## Audit

Les actions suivantes doivent produire un audit log :

- onboarding du compte ;
- création, modification ou archivage propriété/logement/locataire ;
- création, modification ou archivage d'un mandant ;
- import de portefeuille ;
- délivrance d'un lien de partage de quittance (`receipt.share_link_issued`) ;
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

WhatsApp, SMS, PDF et stockage sont des adaptateurs. Aucun prestataire de
paiement n'intervient : le loyer circule directement du locataire à l'agence
(ADR-030).

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
