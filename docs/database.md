# Ranti — Base de Données

## Statut

Version 1.9 (2026-08-09) — pivot entreprises de gestion (ADR-029) et retrait du
rail de paiement (ADR-030). Retirées du modèle : `payment_transactions`,
`payment_proofs`, `ledger_notification_events` et les RPC supprimées par les
migrations `20260809120000` et `20260809120100`. Ajoutées : `owners`,
`properties.owner_id`, `private.app_secrets`, `private.ledger_health`, et les
vues `owner_month_summary`, `reminder_batch`, `ops_grant_drift`,
`ops_ledger_health`. Le sceau de quittance passe sous secret serveur
(HMAC-SHA256, même recette unique `private.receipt_computed_fingerprint`,
migration `20260809120300`) ; la lecture directe de `receipts.tenant_token` est
révoquée (SELECT par colonne), le jeton s'obtient par la RPC journalisée
`receipt_share_token`.

Le titulaire du compte (`landlords`) est l'entreprise de gestion. Le nom de la
table est conservé : le renommer imposerait de réécrire les 35 policies RLS,
`private.current_landlord_id()` et l'ensemble des gardes applicatives, pour un
gain de lisibilité seul.

Version 1.8 (2026-07-27) : **empreinte d'intégrité scellée à l'émission**. `private.generate_receipt_core` écrit `sha256_fingerprint` dans son INSERT (avec `issued_at` figé explicitement, puisqu'il entre dans le calcul) ; `certify_receipt_by_token` ne réécrit plus un sceau existant. La recette est extraite en `private.receipt_computed_fingerprint(number, issued_at, snapshot)` — source unique appelée par l'émission, la certification et les deux chemins de vérification (migrations `20260727120000`, rétro-scellement séparé `20260727120010`). **Appliquées en prod le 2026-07-27** (y enregistrées sous `20260727152507` / `20260727152531`, l'API horodatant elle-même).

Version 1.7 (2026-07-24, v0.3.36.0) : vérification publique par numéro — RPC `verify_receipt_by_number` (SECURITY DEFINER, accordée à `anon` et `authenticated`, verdict calculé côté SQL, ni identité ni montant ni empreinte dans le retour), `get_receipt_by_token` étendue (`payment_method`, `received_at`), index sur `receipts(receipt_number)` (migrations `20260724100000`, `20260724101000`, `20260724140000`, appliquées en prod).

Version 1.6 (2026-07-18, v0.3.29.0) : colonnes de prise en main et de relance sur `landlords` (`onboarding_status`, `reminders_enabled`, `reminder_channel`, `reminder_moment`) ; référence de quittance `RNT-AAAA-NNNN` (migrations `20260717130000`, `20260718120000`, `20260718130000`, `20260718160000`, appliquées en prod).

Version 1.5 — réaligné sur le schéma live (audit 2026-07-16) : `app_users` supprimée du modèle (ADR-010, lien direct `landlords.auth_user_id`), `lease_reminder_rules` et `receipt_items` déclassées en cible non implémentée, schéma `reminders` corrigé sur la table réelle.

Ce document décrit le modèle de référence de la base de données de Ranti. La source de vérité exécutable reste `supabase/migrations/`.

## Objectif

La base doit protéger la mémoire fiable des loyers et répondre clairement à six questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque loyer reçu, si une preuve existe ?
4. Quelle relance est prévue, préparée ou envoyée ?
5. Quel reçu ou quelle quittance a été généré après validation ?
6. Pour chaque mandant, qu'a-t-on encaissé sur ses lots ce mois-ci, retenu en honoraires, et que lui doit-on ?

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

### `landlords`

Le compte : depuis ADR-029, une entreprise de gestion immobilière (un bailleur
qui gère ses propres biens reste un cas particulier valide). Un enregistrement
par compte Supabase Auth. `payment_alias` porte le numéro marchand de l'agence,
affiché au locataire pour qu'il paie directement.

Il n'existe PAS de table `app_users` : le profil métier est lié directement à Supabase Auth par `landlords.auth_user_id = auth.users.id` (ADR-010), et `current_landlord_id()` résout l'appartenance depuis `auth.uid()`.

Champs réels : `id`, `auth_user_id`, `phone`, `first_name`, `last_name`, `civility` (colonne conservée, retirée de l'UI depuis PR #122), `payment_alias`, `payment_alias_type`, `onboarding_status`, `reminders_enabled`, `reminder_channel`, `reminder_moment`, `created_at`, `updated_at`, `deleted_at`.

Prise en main guidée (welcome-flow.md) : `onboarding_status` = `pending` | `guided` | `exploring` | `done` (défaut `pending` ; les propriétaires antérieurs à la migration sont passés `done`). La progression des étapes est dérivée des données réelles au rendu (`lib/onboarding/progress.ts`), jamais stockée.

Réglages de relance par compte (v0.3.29.0) : `reminders_enabled` (booléen, défaut `false`), `reminder_channel` (`whatsapp` | `sms`, `null` = défaut UI whatsapp), `reminder_moment` (`avant` | `echeance` | `retard`, `null` = défaut UI echeance). Persistance seule : le respect côté file de relance (`ops_reminder_queue`, logique ADR-023 gelée) est un suivi, pas encore câblé. Colonnes non-identité : le verrou ADR-002 ne se déclenche pas sur leur update ; écriture via la policy `landlords_update_own`, aucun RPC requis.

Contraintes : `auth_user_id` unique ; `phone` unique ; un utilisateur auth = un propriétaire au MVP.

### `owners` (ADR-029, migration `20260809120500`)

Propriétaire mandant : la personne ou la société pour le compte de laquelle
l'agence gère des biens. Les mandants ne sont pas des utilisateurs — aucun
compte, aucun accès, aucune authentification. Ils reçoivent un relevé mensuel.

Champs : `id`, `landlord_id`, `display_name`, `phone`, `email`, `fee_rate_bp`,
`notes`, `created_at`, `updated_at`, `deleted_at`.

- `display_name` : un seul champ, saisi tel que l'agence l'écrit sur ses
  relevés (personne physique ou société). Non vide après `btrim`.
- `fee_rate_bp` : honoraires de gestion en points de base du loyer encaissé
  (800 = 8 %), entier entre 0 et 10000. Convention du dépôt : jamais de
  flottant sur de l'argent.

Contraintes et index :

- `owners_landlord_name_unique` — unique sur
  `(landlord_id, lower(btrim(display_name)))` où `deleted_at is null`. Sert
  aussi de clé de rapprochement à l'import de portefeuille.
- `owners_landlord_idx` sur `(landlord_id)` où `deleted_at is null`.
- RLS : même patron que les autres tables métier (`landlord_id =
  private.current_landlord_id()` en select, insert, update). Grants
  `authenticated` : SELECT, INSERT, UPDATE. Pas de DELETE — archivage par
  `deleted_at`.
- Triggers : `set_updated_at`, `log_audit` (ADR-006), `audit_soft_archive`.

### `properties`

Propriété physique gérée par le compte, pour son propre compte ou sous mandat.

Champs : `id`, `landlord_id`, `owner_id`, `name`, `address_text`, `city`, `country`, `status`, `created_at`, `updated_at`, `deleted_at`.

`owner_id` (ADR-029) : mandant pour le compte duquel le bien est géré,
référence `owners(id)`, **nullable** — `NULL` signifie un bien détenu en propre
par le titulaire du compte. La nullabilité laisse les portefeuilles antérieurs
valides sans migration de données. Index `properties_owner_idx` sur
`(owner_id)` où `deleted_at is null`.

`properties_landlord_name_unique` (migration `20260809120600`) : unique sur
`(landlord_id, lower(btrim(name)))` où `deleted_at is null`. Sans lui, deux
imports concurrents créent deux biens homonymes et scindent le portefeuille en
silence, le rapprochement par nom se faisant avant le commit de l'autre.

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

### `lease_reminder_rules` — NON IMPLÉMENTÉE (cible)

Cette table n'existe pas dans le schéma live. La cadence de rappel/relance n'est PAS configurable par bail : elle est fixe et codée dans l'application (`apps/web/src/lib/reminders/schedule.ts`, fenêtres J-5 / J-1 / jour J / J+3 / J+10, miroir des templates SMS).

Si des règles par bail deviennent nécessaires (signal terrain), le modèle candidat historique reste : `id`, `landlord_id`, `lease_id`, `rule_type`, `offset_days`, `channel`, `message_template`, `is_active` — mais aucune décision d'implémentation n'est prise.

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

### `payment_proofs` — SUPPRIMÉE (ADR-030, migration `20260809120000`)

Table de pièces jointes de paiement, orpheline : aucun code applicatif ne la
lisait ni ne l'écrivait, et elle comptait 0 ligne en production au 2026-08-09.
Supprimée avec le rail de paiement. Il n'existe aujourd'hui aucun stockage de
justificatif de paiement dans le modèle ; la preuve produite par Ranti est la
quittance (`receipts`).

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

Sceau et certification locataire (migration `20260809120300`) — trois verrous :

1. **Le sceau est un HMAC sous secret serveur.** `sha256_fingerprint` vaut
   `private.receipt_seal(receipt_number, issued_at, snapshot)`, calculé en
   HMAC-SHA256 avec la clé `receipt_seal` de `private.app_secrets`. La formule
   précédente, un SHA-256 sans secret, était reproductible par tout compte
   disposant de `INSERT`/`UPDATE` sur `receipts` : un gestionnaire pouvait
   écrire lui-même une quittance portant `tenant_ack = 'certified'` et
   l'empreinte correspondante, et la page `/verifier` l'affichait « intègre ».
   Les quittances déjà certifiées ont été rescellées sous le nouveau secret
   (`private.reseal_certified_receipts()`), sans modification de leur contenu.
2. **Un trigger interdit l'écriture cliente des colonnes de certification.**
   `private.enforce_receipt_certification()` (`SECURITY INVOKER`, délibérément :
   le verrou repose sur la lecture de `current_user`). À l'insertion par un
   client, la quittance naît toujours unilatérale. En mise à jour, toucher
   `tenant_ack`, `tenant_certified_at`, `sha256_fingerprint`, `contested_*`
   lève `receipt_certification_readonly` ; ressusciter une quittance annulée
   lève `receipt_cancelled_is_final` ; modifier `receipt_number`, `issued_at`,
   `snapshot`, `total_amount` ou `tenant_token` lève
   `receipt_content_immutable`. Les RPC à jeton, qui s'exécutent sous le rôle
   propriétaire, ne sont pas concernées.
3. **Le jeton locataire sort de la portée de lecture du compte.** Le privilège
   `SELECT (tenant_token)` est retiré à `authenticated` ; le lien s'obtient par
   `public.receipt_share_token(p_receipt_id)`, qui journalise chaque accès en
   `audit_logs` (`receipt.share_link_issued`).

**Limite connue, à ne pas surinterpréter.** Le locataire n'a pas de compte : il
reçoit un lien que le gestionnaire lui transmet. Un gestionnaire déterminé peut
donc récupérer ce lien et cliquer à la place de son locataire. Le sceau prouve
qu'un document n'a pas été altéré après certification et que la certification
est passée par le parcours à jeton ; il ne prouve pas l'identité du cliqueur —
c'est déjà ce qu'énonce ADR-013 §4. Rendre l'usurpation impossible suppose un
code à usage unique envoyé au numéro du locataire, arbitrage produit entre
friction et valeur probante, et non un correctif technique. La journalisation
ci-dessus rend au moins la manœuvre traçable.

Format du numéro (`receipt_number`) : depuis le 2026-07-18, `private.generate_receipt_core` émet `RNT-AAAA-NNNN` (année d'émission + séquence annuelle par propriétaire, minimum 4 chiffres, jamais tronquée au-delà de 9999 : `RNT-2026-9999` puis `RNT-2026-10000`). Génération sérialisée par `pg_advisory_xact_lock` par propriétaire. Les documents antérieurs gardent `R-NNNNNN` (pas de backfill) ; les deux préfixes ne collisionnent pas. Migrations `20260718130000` + correctif `20260718160000`.

Empreinte d'intégrité (`sha256_fingerprint`, 2026-07-27) : scellée **à l'émission**, dans l'INSERT de `private.generate_receipt_core`. Auparavant elle n'était écrite qu'à la certification locataire, ce qui laissait toute quittance neuve en état « non scellé » sur `/verifier`. La recette — `receipt_number || issued_at (UTC, µs) || snapshot::text`, SHA-256 hex — vit désormais dans `private.receipt_computed_fingerprint(text, timestamptz, jsonb)` (STABLE, schéma `private` donc hors PostgREST, `EXECUTE` accordé à `authenticated` et `service_role` car `generate_receipt_core` est SECURITY INVOKER). Émission, certification et les deux chemins de vérification l'appellent : une seule recette, donc un seul verdict possible par document. `certify_receipt_by_token` applique `coalesce(sceau existant, recalcul)` — elle atteste l'exactitude (ADR-013), elle ne fabrique plus l'intégrité, et ne scelle plus que les documents antérieurs. Portée : SHA-256 sans secret stockée dans la table qu'elle protège — opposable au tiers, **pas à l'éditeur**. `null` = document émis avant cette migration et jamais certifié. Migration `20260727120000` ; rétro-scellement des documents antérieurs isolé dans `20260727120010` (retirable : un sceau posé après coup ne prouve rien sur la période écoulée).

Vérification publique par numéro (2026-07-24, v0.3.36.0) : la RPC `verify_receipt_by_number(p_number)` (SECURITY DEFINER, accordée à `anon` et `authenticated`) alimente la recherche `/verifier` par référence. Le numéro étant énumérable (séquence annuelle par propriétaire), le retour est volontairement pauvre : verdict d'intégrité calculé côté SQL, type de document, statut et périodes réglées — jamais de nom, de logement, de montant ni d'empreinte ; en cas d'homonymie inter-propriétaires, seul un compte est renvoyé, sans détail. Le chemin riche reste le token non énumérable (`get_receipt_by_token`), qui expose depuis cette version `payment_method` et `received_at` pour la quittance partagée. Migrations `20260724101000` + durcissement `20260724140000`.

### `receipt_items` — NON IMPLÉMENTÉE (remplacée par `receipts.snapshot`)

Cette table n'existe pas dans le schéma live. Le détail des périodes et allocations couvertes par un document est archivé dans `receipts.snapshot` (jsonb) au moment de la génération — c'est ce snapshot que lisent la page `/verifier/[id]` et le PDF. Avantage : le document reste immuable même si les données vivantes évoluent.

### `reminders`

Trace de chaque relance envoyée (schéma live, migration `018_reminders.sql`). Depuis ADR-022, l'envoi est opéré par **ranti-ops** qui écrit dans `reminder_events` — cette table `reminders` (canal SMS de l'ancien cron, supprimé) reste pour l'historique et l'union de lecture des écrans. Les colonnes de planification sur `rent_dues` (`last_reminder_at`, `next_reminder_at`, `reminder_count`) sont dormantes ; la cadence de référence est codée dans l'app (voir `lease_reminder_rules` ci-dessus).

Champs réels : `id`, `rent_due_id`, `landlord_id`, `channel`, `template`, `sent_at`, `recipient`, `status`, `message_id`, `created_at`.

Canaux : `sms`, `whatsapp`.

Statuts : `sent`, `delivered`, `failed`.

Contraintes :

- Une relance vise toujours une échéance (`rent_due_id` NOT NULL).
- Le canal ne devient jamais source de vérité.
- Une relance ne modifie jamais le statut de paiement.
- Les envois WhatsApp opérés par `ranti-ops` alimentent `reminder_events` (table sœur, hors de ce modèle initial).

### `audit_logs`

Trace les actions sensibles.

Champs : `id`, `landlord_id`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `metadata`, `created_at`.

Contraintes : append-only autant que possible ; pas de modification par flux utilisateur standard ; pas de données sensibles inutiles en clair.

### `payment_transactions` — SUPPRIMÉE (ADR-030, migration `20260809120000`)

Ledger du rail de paiement custodial (commission 5 %, split de TVA à 18 %,
reversement du net). Supprimé avec les quatre RPC du rail
(`ingest_payment_notification`, `verify_payment_transaction`,
`reject_payment_transaction`, `mark_payment_transaction_paid_out`) et le
webhook applicatif. La table comptait 0 ligne en production au 2026-08-09.

L'encaissement reste non-custodial : le locataire paie directement l'agence
(espèces, Mobile Money, virement, ou alias enregistré en
`landlords.payment_alias`), et le pipeline d'enregistrement inchangé est
`record_collection_core → confirm_collection_core → generate_receipt_core`
(ADR-017).

Vestiges d'énumération, sans écrivain : `rent_receptions.recorded_by` accepte
toujours `'psp'` (contrainte posée par `20260714120000`) et
`transactions.source` accepte toujours `'feexpay'` (contrainte posée par
`20260716150000`). Leur retrait suppose une migration de contrainte, inscrite
au suivi.

### `ledger_notification_events` — SUPPRIMÉE (migration `20260809120100`)

File de notification des charges variables, sans objet depuis ADR-026. Sa
suppression emporte les vues `ops_ledger_notification_queue` et
`ops_ledger_notifications`. La même migration a retiré `scheduled_reminders.charge_id`
et reconstruit `ops_scheduled_reminders` sur la seule branche loyer.

Quatorze fonctions sans appelant applicatif ont été supprimées au même
passage : les huit RPC de charges (`add_lease_charge`,
`replace_ledger_charge`, `withdraw_ledger_line`, `get_ledger_line_by_token`,
`validate_ledger_line_by_token`, `contest_ledger_line_by_token`,
`retract_contest_by_token`, `schedule_charge_reminder`), le parcours locataire
abandonné par jeton d'échéance (`get_rent_due_by_token`,
`declare_rent_payment_by_token`), et le chemin d'entrée opérateur jamais câblé
(`ops_record_collection`, `ops_confirm_collection`,
`mark_all_overdue_rent_dues`, `update_landlord_identity`).

### `private.app_secrets` (migration `20260809120300`)

Secrets serveur. Aucun rôle client n'y accède : `revoke all` sur `public`,
`anon`, `authenticated` et `service_role`.

Champs : `name` (clé primaire), `value`, `created_at`.

Clé posée : `receipt_seal`, 32 octets aléatoires en hexadécimal, générée à la
migration et laissée intacte en cas de rejeu (`on conflict do nothing`). Elle
alimente `private.receipt_seal()`. Rotation : mettre à jour la valeur puis
rejouer `private.reseal_certified_receipts()`.

### `private.ledger_health` (migration `20260809120400`)

Historique du contrôle d'égalité entre le modèle historique (`rent_dues`) et le
grand livre (`transactions`), qui coexistent depuis la phase « expand »
d'ADR-023 restée inachevée. Aucun grant client.

Champs : `checked_at` (clé primaire), `diverging_leases`, `detail` (jsonb).

`private.check_ledger_health()` exécute `private.verify_ledger_equality()`,
archive le résultat et lève un `warning` si un bail diverge. Planifiée par
pg_cron à 03h10 UTC (`ranti-ledger-health`) ; le bloc de planification tolère
l'absence de pg_cron. Le garde-fou existait déjà mais n'avait jamais été
exécuté après sa propre migration : une divergence apparue en production était
donc silencieuse, et le solde affiché pouvait cesser de correspondre au solde
réel sans signal.

Cette migration ne supprime pas le doublon de comptabilité. La phase
« contract » d'ADR-023 reste à faire.

### `transactions` (ADR-023 « Grand Livre de Confiance », phase Expand, live)

Le grand livre locatif : toute somme due ou reçue sur un bail est une ligne
d'un même compte courant. **Pendant la phase Expand, les tables héritées
(`rent_dues`, `rent_receptions`, `rent_reception_allocations`) restent la
source de vérité** ; le grand livre est tenu à l'identique par des triggers
miroir (`private.mirror_rent_due` / `mirror_allocation` / `mirror_reception`,
SECURITY DEFINER, même transaction Postgres que l'écriture héritée) et un
backfill idempotent (clé `legacy_ref`, `on conflict do nothing`).

La phase « contract » n'a jamais eu lieu : les deux modèles coexistent et le
tableau de bord interroge les deux sur la même page. L'égalité entre eux est
désormais contrôlée chaque jour (`private.ledger_health`, vue
`public.ops_ledger_health`).

Champs : `id`, `landlord_id`, `lease_id`, `type`
(`loyer`/`reparation`/`frais`/`reglement`/`contre_passation`), `direction`
(`debit`/`credit`), `amount` (FCFA entier > 0), `currency` (`XOF`),
`occurred_at` (date de l'événement économique — l'ordre du relevé),
`due_date` (exigibilité, débits seulement), `period_start`/`period_end`
(mois couvert, loyers seulement — règles ADR-004), `status`
(`pending`/`validated`/`disputed`/`withdrawn`), `validated_by`
(`landlord`/`tenant`/`system`) + `validated_at`, `disputed_at` +
`contest_nature` (`amount`/`not_owed`/`already_paid`/`other`) +
`contested_amount` + `tenant_comment` (deux voix, modèle ADR-013),
`resolution` (`retrait_contestation`/`retrait_auteur`/`remplacement`) +
`resolved_at`, `reversal_of` (contre-passation → ligne d'origine),
`replaced_by`, `tenant_token` (accès public locataire, posé en phase
« différenciant »), `source`
(`genere_par_bail`/`manuel`/`feexpay`/`declaration_locataire`), `label`,
`legacy_ref` (correspondance héritée, transitoire — tombe à la phase
Contract).

Machine à états (triggers durs, ADR-023 §4) : une ligne naît `pending` ou
`validated` ; `pending → validated | disputed | withdrawn` ;
`disputed → validated` (uniquement `resolution = 'retrait_contestation'`)
`| withdrawn` ; **`validated` et `withdrawn` sont terminaux** ; `DELETE`
refusé quel que soit le statut ; identité financière gelée dès l'insertion
(corriger = retirer et réémettre, jamais éditer). Une contre-passation ne
vise qu'une ligne `validated` du même bail, de sens opposé, dans la limite
du montant non déjà contre-passé — jamais une autre contre-passation.

Correspondance miroir/backfill (statuts dérivés de la matrice ADR-023 §3) :

| Héritée | Ligne du grand livre |
| :-- | :-- |
| `rent_due` (toutes) | débit `loyer` `validated(system)`, `legacy_ref = due:<id>` |
| `rent_due` annulée/archivée | paire débit + contre-passation `validated` (motif repris) |
| allocation d'une réception confirmée | crédit `reglement` `validated(landlord)` — ou `validated(system)` + `source feexpay` si `recorded_by = 'psp'` ; `legacy_ref = alloc:<id>` |
| allocation d'une réception `draft` | crédit `pending` (`declaration_locataire` si `recorded_by = 'tenant'`) |
| réception confirmée puis annulée (ADR-005) | paire crédit `validated` + contre-passation `validated` (motif repris) |
| réception `draft` annulée | crédit `withdrawn` (`retrait_auteur`) — jamais devenu certain |

Granularité transitoire : une ligne de crédit **par allocation** (projection
fidèle du modèle hérité). L'argent confirmé non affecté (fast-log ADR-014)
n'entre pas encore au grand livre par bail — il reste visible au journal.

Garde d'égalité : `private.verify_ledger_equality()` (service_role) compare,
par bail, le solde certain du grand livre à l'opposé du restant dû hérité —
restreinte à la **projection héritée** (loyers, règlements et leurs
contre-passations) : une charge validée est une vérité que le modèle hérité
ignore par construction. Exécutée en fin de migration Expand (tout écart la
fait échouer), elle reste le détecteur de dérive du miroir.

> **Charges variables retirées (ADR-026, puis migration `20260809120100`).**
> Les huit RPC de charges et la vue `ops_ledger_notifications` sont
> **supprimées**, ainsi que la table `ledger_notification_events`. Restent en
> base sans écrivain : la colonne `tenant_token`, les types
> `reparation`/`frais` de la contrainte `type`, et les colonnes
> `pending_debits` / `disputed_debits` de `lease_balances` (valeur 0).

Écritures : aucun grant client (`authenticated` = SELECT sous RLS
`landlord_id = private.current_landlord_id()`). Deux voies d'écriture
subsistent, le backfill et les triggers miroir. Audit `private.log_audit()` sur
insert/update (ADR-006).

### `lease_balances` (vue, ADR-023 §6)

La file opérateur `ops_reminder_queue` joint cette vue : les relances de
**retard** sont gatées sur `overdue_amount > 0` (garde compte courant — une
avance nette la dette quel que soit le mois affecté), et l'impayé du bail est
exposé à ranti-ops en colonne `ledger_overdue_amount`. Les rappels
pré-échéance ne sont pas gatés.

Trois nombres par bail, jamais fusionnés, calculés en base
(`security_invoker`, la RLS de `transactions` s'applique) :
`certain_balance` (Σ crédits validés − Σ débits validés), `pending_debits` /
`pending_credits` (affirmé, pas reconnu), `disputed_debits` /
`disputed_credits` (désaccord documenté), `overdue_amount` (impayé : lignes
certaines exigibles aujourd'hui, débits moins crédits, plancher zéro — une
contre-passation hérite de l'exigibilité de sa cible : annuler une échéance
future ne réduit pas l'impayé du jour ; un débit sans date est dû tout de
suite).

## Vues

### `owner_month_summary` (ADR-029, migration `20260809120700`)

Clôture du mois en cours par mandant : ce que l'agence lit sur `/cloture` avant
d'ouvrir un relevé.

Colonnes : `owner_id`, `landlord_id`, `display_name`, `fee_rate_bp`, `units`,
`collected`, `fee`, `net_due_to_owner`.

Les honoraires sont calculés lot par lot, à l'arrondi inférieur, puis
additionnés — la même règle que `owner_statement`. Appliquer le taux au total
du mandant donnerait un net différent de celui du relevé remis, donc deux
chiffres pour la même chose.

`security_invoker = true` : la vue hérite de la RLS des tables sous-jacentes,
une agence ne voit que ses mandants. `revoke all` sur `anon`, `grant select` à
`authenticated`.

### `reminder_batch` (ADR-029, migration `20260809120800`)

File de relance du portefeuille : une ligne par échéance non soldée dont la
date approche (J-5) ou est dépassée, avec le reste dû et le canal de contact.

Colonnes : `rent_due_id`, `landlord_id`, `lease_id`, `tenant_id`, `owner_id`,
`owner_name`, `property_name`, `unit_name`, `tenant_name`, `tenant_phone`,
`period_start`, `period_end`, `due_date`, `currency`, `amount_remaining`,
`days_from_due`, `reminder_type` (`j_5` | `j_1` | `late_j_1` | `late_j_3`),
`last_reminder_at`, `reminder_count`, `confirmation_token`.

Filtres : échéance non annulée et non archivée, bail et locataire vivants,
téléphone du locataire renseigné, reste dû strictement positif,
`due_date - current_date <= 5`.

`security_invoker = true`. `revoke all` sur `anon`, `grant select` à
`authenticated`. Écriture de la trace par `public.log_reminder_batch()`.

### `ops_grant_drift` (migration `20260809120200`)

Vue de contrôle d'exploitation : liste les tables publiques dont la RLS serait
désactivée, ou qui porteraient un privilège `DELETE`, `TRUNCATE`, `REFERENCES`
ou `TRIGGER` accordé à `anon` ou `authenticated`.

Colonnes : `table_name`, `rls_enabled`, `policies`, `unexpected_privileges`.

Vide = base conforme aux migrations. Toute ligne signale une DDL appliquée hors
migration. Réservée au `service_role`.

La migration qui l'introduit répare deux dérives constatées le 2026-08-09 entre
la production et le dépôt : `reminders` et `reminder_events` portaient une
policy sans qu'aucune migration n'active la RLS — sur une base reconstruite
depuis le dépôt, ces policies étaient inertes et tout compte authentifié lisait
les relances de tous les portefeuilles ; `receipts` accordait en production
`DELETE`, `TRUNCATE`, `REFERENCES` et `TRIGGER` à `authenticated`, là où sa
migration n'accorde que `SELECT`, `INSERT`, `UPDATE`. La réparation est
générique et idempotente : balayage de toutes les tables publiques, plus un
`alter default privileges` pour qu'une table créée plus tard n'hérite d'aucun
droit d'écriture pour `anon`.

### `ops_ledger_health` (migration `20260809120400`)

Trente derniers contrôles d'égalité entre `rent_dues` et `transactions`.

Colonnes : `checked_at`, `diverging_leases`, `healthy`, `detail`.

Réservée au `service_role`. `diverging_leases > 0` est un incident comptable.

## Tables Post-MVP

### `notification_deliveries`

Trace les tentatives d'envoi via WhatsApp, SMS ou email. Nécessaire seulement quand Ranti envoie réellement via un prestataire.

### `public_links`

Liens partageables contrôlés pour reçu, preuve, relance ou action locataire sans compte complet.

Post-MVP sauf besoin terrain urgent.

Contraintes futures : token brut jamais stocké ; expiration/révocation ; accès limité au but du lien.

## Relations principales

```txt
auth.users -> landlords (auth_user_id)
landlords -> owners (mandants — sans compte, ADR-029)
owners -> properties (owner_id, nullable : NULL = bien détenu en propre)
landlords -> properties -> units -> leases -> rent_dues
landlords -> tenants -> leases
rent_dues -> rent_reception_allocations -> rent_receptions
rent_dues -> reminders
rent_dues -> reminder_events (relances tracées, dont les lots)
rent_receptions -> receipts (snapshot jsonb archive périodes + allocations)
leases -> transactions (grand livre locatif, ADR-023 — miroir des lignes ci-dessus pendant l'Expand)
landlords -> audit_logs
```

Tables live hors modèle initial : `transactions` + vue `lease_balances` (grand livre ADR-023), `owners` (mandants, ADR-029), `product_events` (instrumentation), `reminder_events` (relances WhatsApp), `idempotency_keys`, `scheduled_reminders`, vue `journal_feed`.

## Règles d'intégrité métier

1. Tout objet métier appartient à un compte (`landlord_id`).
2. Un bail relie un logement et un locataire.
3. Un logement ne peut pas avoir deux baux actifs sur une période qui se chevauche.
4. Une échéance vient d'un bail.
5. La cadence de rappel/relance dérive du bail et de ses échéances (fixe au MVP, non configurable par bail).
6. Une relance vise toujours une échéance.
7. Une réception de loyer confirmée doit être allouée à une ou plusieurs échéances.
8. Un reçu ou une quittance vient après confirmation d'une réception de loyer.
9. Un reçu ou une quittance généré ne se modifie pas silencieusement.
10. Les fichiers sensibles sont protégés.
11. Les actions critiques sont auditées.
12. Un bien peut être rattaché à un mandant (`properties.owner_id`). Le mandant appartient au même compte que le bien, n'a ni compte ni accès, et n'est jamais une frontière d'isolation : le cloisonnement reste porté par `landlord_id`.
13. Les colonnes de certification d'une quittance ne s'écrivent que par les RPC à jeton du parcours locataire.

## Index recommandés

```txt
landlords(auth_user_id)
properties(landlord_id)
units(landlord_id, property_id)
tenants(landlord_id)
leases(landlord_id, unit_id, status)
leases(landlord_id, tenant_id, status)
rent_dues(landlord_id, status, due_date)
rent_dues(landlord_id, tenant_id, due_date)
rent_dues(lease_id, period_start, period_end)
rent_dues(status, next_reminder_at) partiel — cron de relance
rent_receptions(landlord_id, tenant_id, received_at)
rent_reception_allocations(rent_reception_id)
rent_reception_allocations(rent_due_id)
owners(landlord_id) partiel — deleted_at is null
owners(landlord_id, lower(btrim(display_name))) unique partiel — clé de rapprochement de l'import
properties(landlord_id, lower(btrim(name))) unique partiel — clé de rapprochement de l'import
properties(owner_id) partiel — deleted_at is null
receipts(landlord_id, receipt_number)
receipts(receipt_number) — recherche publique par référence (/verifier)
receipts(landlord_id, tenant_id, issued_at)
reminders(rent_due_id, sent_at desc)
reminders(landlord_id, created_at desc)
audit_logs(landlord_id, entity_type, entity_id)
audit_logs(actor_user_id, created_at)
```

## Sécurité et accès

- Un compte ne voit que les données de son `landlord_id`. Le mandant n'ajoute
  pas de frontière : les biens de tous ses mandants appartiennent au même
  portefeuille.
- Cette règle doit être appliquée côté serveur et, si possible, via politiques de sécurité base.
- Le locataire n'a pas d'espace complet par défaut au MVP.
- L'accès administrateur est limité, tracé et réservé au support ou à la sécurité.
- `anon` n'écrit jamais en direct : `INSERT` et `UPDATE` lui sont retirés sur
  toutes les tables publiques, et les privilèges par défaut du schéma `public`
  excluent l'écriture pour ce rôle. Le parcours locataire passe par des RPC
  `SECURITY DEFINER` à jeton.
- `DELETE`, `TRUNCATE`, `REFERENCES` et `TRIGGER` ne sont accordés ni à `anon`
  ni à `authenticated` sur aucune table publique. La suppression logique passe
  par `deleted_at`.
- Contrôle : `public.ops_grant_drift` doit rester vide.

## Suppression et archivage

Suppression physique acceptable pour brouillons sans impact, données créées par erreur avant activation, événements techniques non critiques après rétention.

Suppression physique à éviter pour baux, règles de rappel, échéances, réceptions de loyer, allocations, preuves, reçus, relances envoyées, audit logs.

Préférer `archived`, `cancelled`, `reversed`, `deleted_at` avec audit, ou une correction.

## Exclu du périmètre

- Partage d'un compte entre plusieurs employés, équipes et rôles granulaires (ADR-029, remis à plus tard).
- Portail mandant : le mandant reçoit un relevé, il ne se connecte pas.
- Portail locataire complet.
- Liens publics contrôlés.
- Envoi automatique externe non maîtrisé.
- Comptabilité complète.
- Détention de fonds et paiement en ligne par un rail au nom de Ranti (ADR-030).
- Rapprochement bancaire automatique.
- Analytics avancés.

## Questions ouvertes avant migrations SQL

1. Prestataire d'authentification initial.
2. Format exact de l'identifiant utilisateur.
3. Politique de stockage des preuves. *(Sans objet depuis le 2026-08-09 : `payment_proofs` est supprimée, aucun justificatif de paiement n'est stocké.)*
4. Format du numéro de reçu. *(Résolu 2026-07-18 : `RNT-AAAA-NNNN`, voir `receipts`.)*
5. Stratégie exacte de génération des échéances.
6. Stratégie de correction d'un reçu déjà généré.
7. SQL exact pour empêcher les baux actifs qui se chevauchent sur un même logement.
8. Stratégie exacte de génération des règles et relances.
9. Statut exact à utiliser pour reçu partiel, reçu complet et quittance.

## Ordre des migrations (réalisé)

1. `landlords`
2. `properties`
3. `units`
4. `tenants`
5. `leases`
6. `rent_dues`
7. `rent_receptions`
8. `rent_reception_allocations`
9. `payment_proofs` — supprimée le 2026-08-09 (ADR-030)
10. `receipts`
11. `audit_logs`
12. `reminders` (018)
13. `payment_transactions` (ADR-018) — supprimée le 2026-08-09 (ADR-030)
14. `transactions` + vue `lease_balances` (ADR-023, phase Expand)

Passe du 2026-08-09 (ADR-029 et ADR-030), migrations `20260809120000` à
`20260809120800` :

15. retrait du rail de paiement (`payment_transactions`, `payment_proofs`, RPC)
16. retrait des charges variables et des 14 fonctions sans appelant
17. réparation RLS et privilèges + vue `ops_grant_drift`
18. durcissement du sceau de quittance (`private.app_secrets`, trigger, `receipt_share_token`)
19. contrôle quotidien du grand livre (`private.ledger_health`, vue `ops_ledger_health`)
20. `owners` + `properties.owner_id`
21. import de portefeuille (`validate_portfolio_import`, `import_portfolio`)
22. relevé du mandant (`owner_statement`, `owner_statement_lines`, vue `owner_month_summary`)
23. relance par lot (vue `reminder_batch`, `log_reminder_batch`)

Post-MVP : `notification_deliveries`, `public_links`, `lease_reminder_rules`, `receipt_items` (si le snapshot jsonb ne suffit plus).

## Phrase de contrôle

La base de données de Ranti doit pouvoir raconter l'histoire suivante sans ambiguïté :

> Cette agence gère ce logement pour ce mandant. Ce locataire l'occupe selon ce bail. Pour ce mois, cette échéance était attendue. Voici ce qui a été reçu. Voici la quittance ou le reçu généré. Voici la relance prévue ou envoyée. Voici ce qui revient au mandant, honoraires déduits. Voici l'historique des actions.

Si le schéma ne permet plus de raconter cette histoire simplement, il doit être corrigé.
