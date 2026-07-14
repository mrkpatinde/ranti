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

### Fixed

- Encaissement cash réparé : la surcharge 7 arguments de `record_collection`
  rendait l'appel du formulaire propriétaire ambigu (erreur 42725 vérifiée en
  prod) — supprimée, le défaut `p_reference` couvre tous les appels.
- Divergence prod/local des privilèges : grants explicites (tables +
  fonctions) pour `authenticated` et `service_role` — le flux propriétaire et
  le cockpit ops fonctionnent désormais sur un stack local durci, et la prod
  ne dépend plus des défauts legacy. Tests d'assertion + smoke sous
  `set local role` dans la suite SQL.
- Calcul des frais en `bigint` intermédiaire : un loyer au-delà de ~11,9M FCFA
  ne provoque plus d'overflow int4 (parité TS/SQL assertée des deux côtés).

### Changed

- Politique statut du webhook : seul un échec PSP explicite est ignoré ; tout
  autre statut (succès, inconnu, absent) est ingéré `pending` et arbitré par
  le propriétaire — un paiement réel au vocabulaire imprévu n'est jamais
  perdu derrière un 200 non rejoué.
- `rent_receptions.recorded_by` accepte la nouvelle origine `psp` ; les
  surcharges SQL ambiguës (`record_collection_core` 10 args,
  `record_collection` 7 args) et `public.current_landlord_id()` orpheline
  sont supprimées.
- Index du ledger : composite `(landlord_id, created_at desc)` pour la vue
  propriétaire, FK `rent_reception_id` indexée ; lecture ledger bornée à 200.
- ADR-009 (alias P2P) partiellement supersédé et ADR-017 (notifications
  serveur) concrétisé par l'ADR-018 v3 ; `docs/database.md` et
  `docs/roadmap.md` à jour.

### Security

- Écritures du ledger uniquement via RPC `SECURITY DEFINER` (webhook et ops en
  `service_role`, validation propriétaire avec garde d'appartenance) ; aucune
  écriture cliente directe ; assertions de GRANTs dans la suite SQL.
- Le webhook ne révèle plus l'état de sa configuration (noms d'env vars) à un
  appelant non authentifié, et sa réponse n'expose que des champs explicites.
- Invariant testé : les cœurs `private.*_core` accordés à `authenticated`
  restent `SECURITY INVOKER` (la RLS est leur seule garde d'appartenance).
- ⚠️ Activation production bloquée sur validation juridique BCEAO (caveat
  ADR-018) — sandbox uniquement.
