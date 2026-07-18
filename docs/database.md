# Ranti — Base de Données

## Statut

Version 1.6 (2026-07-18, v0.3.29.0) : colonnes de prise en main et de relance sur `landlords` (`onboarding_status`, `reminders_enabled`, `reminder_channel`, `reminder_moment`) ; référence de quittance `RNT-AAAA-NNNN` (migrations `20260717130000`, `20260718120000`, `20260718130000`, `20260718160000`, appliquées en prod).

Version 1.5 — réaligné sur le schéma live (audit 2026-07-16) : `app_users` supprimée du modèle (ADR-010, lien direct `landlords.auth_user_id`), `lease_reminder_rules` et `receipt_items` déclassées en cible non implémentée, schéma `reminders` corrigé sur la table réelle.

Ce document décrit le modèle de référence de la base de données de Ranti. La source de vérité exécutable reste `supabase/migrations/`.

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

### `landlords`

Propriétaire ou espace propriétaire. Il n'existe PAS de table `app_users` : le profil métier est lié directement à Supabase Auth par `landlords.auth_user_id = auth.users.id` (ADR-010), et `current_landlord_id()` résout l'appartenance depuis `auth.uid()`.

Champs réels : `id`, `auth_user_id`, `phone`, `first_name`, `last_name`, `civility` (colonne conservée, retirée de l'UI depuis PR #122), `payment_alias`, `payment_alias_type`, `onboarding_status`, `reminders_enabled`, `reminder_channel`, `reminder_moment`, `created_at`, `updated_at`, `deleted_at`.

Prise en main guidée (welcome-flow.md) : `onboarding_status` = `pending` | `guided` | `exploring` | `done` (défaut `pending` ; les propriétaires antérieurs à la migration sont passés `done`). La progression des étapes est dérivée des données réelles au rendu (`lib/onboarding/progress.ts`), jamais stockée.

Réglages de relance par propriétaire (FirstRun, v0.3.29.0) : `reminders_enabled` (booléen, défaut `false`), `reminder_channel` (`whatsapp` | `sms`, `null` = défaut UI whatsapp), `reminder_moment` (`avant` | `echeance` | `retard`, `null` = défaut UI echeance). Persistance seule : le respect côté file de relance (`ops_reminder_queue`, logique ADR-023 gelée) est un suivi, pas encore câblé. Colonnes non-identité : le verrou ADR-002 ne se déclenche pas sur leur update ; écriture via la policy `landlords_update_own`, aucun RPC requis.

Contraintes : `auth_user_id` unique ; `phone` unique ; un utilisateur auth = un propriétaire au MVP.

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

Format du numéro (`receipt_number`) : depuis le 2026-07-18, `private.generate_receipt_core` émet `RNT-AAAA-NNNN` (année d'émission + séquence annuelle par propriétaire, minimum 4 chiffres, jamais tronquée au-delà de 9999 : `RNT-2026-9999` puis `RNT-2026-10000`). Génération sérialisée par `pg_advisory_xact_lock` par propriétaire. Les documents antérieurs gardent `R-NNNNNN` (pas de backfill) ; les deux préfixes ne collisionnent pas. Migrations `20260718130000` + correctif `20260718160000`.

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

### `payment_transactions` (ADR-018 v4 « All-Inclusive 5 % », live)

Ledger du rail PSP : une ligne par notification de paiement, jamais droppée
(un montant inattendu est enregistré `rejected` avec raison). Le locataire
paie exactement le loyer ; Ranti prélève **5 % tout compris**, le net (95 %)
est reversé au propriétaire via l'API payout du PSP. Les frais PSP sont des
**dépenses internes de Ranti**, invisibles du propriétaire. Les fonds vivent
dans le wallet marchand chez le PSP agréé (comparatif dans ADR-018).

Champs — vision reçu (lisible par le propriétaire, grants par colonne) :
`id`, `landlord_id`, `lease_id`, `provider`
(`fedapay`/`feexpay`/`kkiapay`), `provider_reference` (unique par provider —
clé d'idempotence), `amount_received` (brut, FCFA entier), `service_fee_bp`
(défaut 500) et `service_fee` (commission tout compris), `net_amount`
(reversé au propriétaire), `currency` (`XOF`), `status`
(`pending`/`verified`/`paid_out`/`rejected`), `rejection_reason`,
`rent_reception_id`, `created_at`, `verified_at`, `paid_out_at`.

Champs — vision comptabilité (service_role UNIQUEMENT, aucun grant
`authenticated`) : `payload` (charge utile webhook brute), `payin_cost_bp`
(défaut 170), `payout_cost_bp` (défaut
100), `payin_cost` (sur le brut), `payout_cost` (sur le net reversé),
`net_margin = service_fee − payin_cost − payout_cost` — rentabilité réelle
par transaction, peut être négative (information, pas erreur).

Machine à états : `pending` (webhook ingéré) → `verified` (**validation du
propriétaire** — déclenche réception + quittance) → `paid_out` (net reversé,
ops) ; `rejected` terminal depuis `pending`. Aucun retour en arrière.

Contraintes : CHECKs arithmétiques (`floor(montant × bp / 10000)` par
composant en produit `bigint`, `net_amount = brut − service_fee`,
`payout_cost` calculé sur `net_amount`, `net_margin` verrouillé — chaque
vision balance par construction) ;
`verified`/`paid_out` ⇒ `rent_reception_id` non nul ; `paid_out` ⇔
`paid_out_at` non nul. Écritures uniquement via RPC SECURITY DEFINER :
`ingest_payment_notification` / `reject_payment_transaction` /
`mark_payment_transaction_paid_out` = `service_role` seul ;
`verify_payment_transaction` = `authenticated` avec garde d'appartenance
(`landlord_id = private.current_landlord_id()`). `authenticated` = SELECT
**par colonne** (vision reçu seule) sous RLS — `select *` et `count(*)` sont
refusés à `authenticated` sur cette table, utiliser des colonnes explicites. La validation passe par le pipeline existant
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

### `transactions` (ADR-023 « Grand Livre de Confiance », phase Expand, live)

Le grand livre locatif : toute somme due ou reçue sur un bail est une ligne
d'un même compte courant. **Pendant la phase Expand, les tables héritées
(`rent_dues`, `rent_receptions`, `rent_reception_allocations`) restent la
source de vérité** ; le grand livre est tenu à l'identique par des triggers
miroir (`private.mirror_rent_due` / `mirror_allocation` / `mirror_reception`,
SECURITY DEFINER, même transaction Postgres que l'écriture héritée) et un
backfill idempotent (clé `legacy_ref`, `on conflict do nothing`). Ne pas
confondre avec `payment_transactions` (ledger du rail PSP, ADR-018) : le rail
trace l'argent chez le PSP, le grand livre trace la relation bailleur/locataire.

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

Écritures : aucun grant client (`authenticated` = SELECT sous RLS
`landlord_id = private.current_landlord_id()`). Voies d'écriture : le
backfill, les triggers miroir, et les RPC de la phase « différenciant » —
côté bailleur (`SECURITY DEFINER` + garde `private.current_landlord_id()`,
`authenticated`) : `add_lease_charge` (charge `reparation`/`frais` née
`pending` + `tenant_token`, idempotente par `p_request_id`, scope
`add_lease_charge` d'`idempotency_keys`, bail actif uniquement),
`withdraw_ledger_line` (pending/disputed → `withdrawn`, motif obligatoire
tracé en `audit_logs`), `replace_ledger_charge` (retrait + réémission liée
`replaced_by`, nouveau token) ; côté locataire (clés sur `tenant_token`,
`anon` + `authenticated`, retours en chaînes de statut — modèle ADR-013) :
`get_ledger_line_by_token`, `validate_ledger_line_by_token`,
`contest_ledger_line_by_token` (natures `amount`/`not_owed`/`already_paid`/
`other`, première version jamais écrasée), `retract_contest_by_token`
(seule sortie disputed → validated). Audit `private.log_audit()` sur
insert/update (ADR-006).

Vue `ops_ledger_notifications` (service_role uniquement) : contrat de
notification ranti-ops (ADR-022 reconduit) — lignes `reparation`/`frais` en
`pending` (`validation_requested`) ou `disputed`, avec token, téléphones et
noms. Le filet manuel wa.me vit dans la fiche bail.

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
landlords -> properties -> units -> leases -> rent_dues
landlords -> tenants -> leases
rent_dues -> rent_reception_allocations -> rent_receptions
rent_receptions -> payment_proofs
rent_dues -> reminders
rent_receptions -> receipts (snapshot jsonb archive périodes + allocations)
leases -> payment_transactions (ledger rail PSP, ADR-018)
leases -> transactions (grand livre locatif, ADR-023 — miroir des trois lignes ci-dessus pendant l'Expand)
landlords -> audit_logs
```

Tables live hors modèle initial : `payment_transactions` (ledger PSP), `transactions` + vue `lease_balances` (grand livre ADR-023), `product_events` (instrumentation), `reminder_events` (envois WhatsApp ranti-ops), vue `journal_feed`.

## Règles d'intégrité métier

1. Tout objet métier appartient à un propriétaire.
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
payment_proofs(landlord_id, rent_due_id)
payment_proofs(landlord_id, rent_reception_id)
receipts(landlord_id, receipt_number)
receipts(landlord_id, tenant_id, issued_at)
reminders(rent_due_id, sent_at desc)
reminders(landlord_id, created_at desc)
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
9. `payment_proofs`
10. `receipts`
11. `audit_logs`
12. `reminders` (018)
13. `payment_transactions` (ADR-018)
14. `transactions` + vue `lease_balances` (ADR-023, phase Expand)

Post-MVP : `notification_deliveries`, `public_links`, `lease_reminder_rules`, `receipt_items` (si le snapshot jsonb ne suffit plus).

## Phrase de contrôle

La base de données de Ranti doit pouvoir raconter l'histoire suivante sans ambiguïté :

> Ce propriétaire a ce logement. Ce locataire l'occupe selon ce bail. Pour ce mois, cette échéance était attendue. Voici ce qui a été reçu. Voici la preuve s'il y en a une. Voici le reçu ou la quittance généré. Voici la relance prévue ou envoyée. Voici l'historique des actions.

Si le schéma ne permet plus de raconter cette histoire simplement, il doit être corrigé.
