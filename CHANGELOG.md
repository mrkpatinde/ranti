# Changelog

Toutes les évolutions notables de Ranti sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/) ; versions en `MAJOR.MINOR.PATCH.MICRO`.

## [0.1.0.0] - 2026-07-14

### Added

- Cœur transactionnel PSP (ADR-018) : le loyer peut désormais être encaissé via
  un agrégateur de paiement agréé (recommandation FedaPay après étude
  comparative), avec un ledger `payment_transactions` qui trace chaque
  notification de paiement — même les montants inattendus, enregistrés
  `rejected` et jamais perdus.
- Webhook `POST /api/payments/notification` signé HMAC-SHA256, idempotent :
  rejouer une notification ne crée jamais de doublon, et un événement que le
  PSP annonce lui-même en échec est ignoré sans écriture.
- Validation par le propriétaire : une transaction ingérée reste `pending`
  jusqu'à sa validation, qui déclenche atomiquement réception, confirmation et
  quittance via le pipeline existant. Un propriétaire ne peut pas valider la
  transaction d'un autre.
- Reversement tracé : statut `paid_out` horodaté quand le net (97 %) est
  reversé au propriétaire.
- Frais serveur inviolables : 1,8 % PSP + 1,2 % Ranti = 3,0 %, calculés en
  entiers FCFA (floor par composant, le total balance toujours), taux archivés
  sur chaque ligne — un changement de tarif futur n'altère pas l'historique.
- Module `calculatePayout` (TS) miroir du calcul SQL, et intégration PSP isolée
  dans `src/lib/kkiapay/`.

### Changed

- `rent_receptions.recorded_by` accepte la nouvelle origine `psp` ; la
  surcharge SQL ambiguë de `record_collection_core` (10 arguments) est
  supprimée.
- ADR-009 (alias P2P) partiellement supersédé et ADR-017 (notifications
  serveur) concrétisé par l'ADR-018 v3 ; `docs/database.md` et
  `docs/roadmap.md` à jour.

### Security

- Écritures du ledger uniquement via RPC `SECURITY DEFINER` (webhook et ops en
  `service_role`, validation propriétaire avec garde d'appartenance) ; aucune
  écriture cliente directe ; assertions de GRANTs dans la suite SQL.
- ⚠️ Activation production bloquée sur validation juridique BCEAO (caveat
  ADR-018) — sandbox uniquement.
