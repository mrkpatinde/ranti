# Changelog

Toutes les évolutions notables de Ranti sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/) ; versions en `MAJOR.MINOR.PATCH.MICRO`.

## [0.3.1.0] - 2026-07-15

### Security

- Une notification de paiement rejouée avec la même référence mais un montant
  ou un bail différent est désormais refusée (`reference_conflict`) au lieu
  d'être absorbée en silence : le registre d'origine fait foi et l'anomalie
  (référence recyclée, bug amont, tentative d'empoisonnement) devient visible.
- La lecture comptable interne du ledger (`service_role`) repose sur un
  privilège explicite et testé, plus sur les réglages par défaut de la base.
- Le garde-fou anti-fuite passe en liste blanche stricte : exactement les
  16 colonnes de la vision reçu sont lisibles par un propriétaire connecté —
  une colonne en plus (coûts PSP, marge, payload) ou en moins fait échouer
  la suite SQL.

### Fixed

- Un taux de service supérieur à 100 % est refusé des deux côtés (TypeScript
  et SQL) : au-delà, le net devenait négatif et les deux calculs pouvaient
  diverger d'un franc.

### Changed

- ADR-018 : les passages du modèle v3 (3 %, deux composants) sont marqués
  supersédés par le modèle « All-Inclusive 5 % » (v4) ; la décision sur les
  replays divergents y est documentée.

## [0.3.0.0] - 2026-07-15

### Added

- Page de vérification de démonstration `/verifier/demo`, liée depuis la
  landing : chacun peut voir à quoi ressemble le contrôle public d'une
  quittance avant de créer un compte. La page s'annonce clairement comme un
  exemple (« sans valeur probante », numéro fictif `RNT-2026-DEMO`) — une
  fausse quittance ne peut pas s'appuyer sur elle pour paraître authentique.
- Section « Tarif » sur la landing : 5 % tout compris, uniquement sur les
  loyers encaissés via Ranti (100 000 F → 5 000 F de frais, 95 000 F reversés).

### Changed

- Refonte de la landing : voix « vous » sur toute la page (supersède la voix
  « je » d'ADR-014), héro recentré sur « Le registre de loyer des
  propriétaires africains », nouvelle section « Preuve » (quittance numérotée,
  confirmée par le locataire, vérifiable par lien public), fonctionnement en
  trois étapes resserrées ; les piliers et le tableau comparatif disparaissent.
- Le badge de confiance du héro devient « Ranti ne détient jamais vos fonds »,
  exact dans les deux modes de paiement (direct ou encaissement via le
  partenaire agréé) et aligné sur la FAQ.
- La FAQ « Ranti encaisse-t-il l'argent ? » présente désormais les deux modes ;
  réponses FAQ en 16 px pour la lecture mobile.
- La description du site (résultats de recherche, partages) adopte la même
  voix et le même positionnement que la nouvelle landing.

## [0.2.0.0] - 2026-07-14

### Changed

- Modèle économique « All-Inclusive 5 % » (ADR-018 v4) : le propriétaire voit
  désormais une commission unique de 5 % tout compris et reçoit 95 % du loyer
  — les frais du PSP ont disparu de son reçu, ils deviennent des dépenses
  internes de Ranti.
- Rentabilité en temps réel : chaque transaction porte sa marge nette
  (`net_margin` = commission − coût d'encaissement sur le brut − coût de
  reversement sur le net), calculée en entiers FCFA et verrouillée par
  contraintes. Une marge négative est une information de pilotage, pas une
  erreur. PSP retenu : FeexPay (décision CEO) — taux archivés par ligne, un
  changement de prestataire n'altère pas l'historique.
- `calculateTransactionDetails(grossAmount)` (TS) remplace `calculatePayout`,
  miroir exact du calcul SQL, et retourne les deux visions (reçu + compta).

### Security

- Les deux visions sont séparées **en base** par des privilèges au niveau
  colonne : un propriétaire connecté ne peut pas lire la marge de Ranti ni
  les coûts PSP (`permission denied` testé sous le rôle `authenticated` dans
  la suite SQL, en plus des assertions de privilèges).
- La migration refuse de s'appliquer si le ledger contient déjà des lignes
  (le reshape suppose une table vide — garde fail-fast).

## [0.1.0.1] - 2026-07-14

### Changed

- Landing : la ligne « Cosme D. » de la carte hero rejoue en boucle le moment
  magique du produit — « SMS MoMo collé… » devient « Déclaré » (animation CSS,
  figée sur l'état final en `prefers-reduced-motion`).
- Landing : la section « Pourquoi Ranti » devient la preuve sociale honnête du
  pilote — pas de faux témoignages : une quittance certifiée, numérotée et
  vérifiable par lien public, avec la mention « leurs mots arriveront ici —
  pas avant ».
- Landing : badge « Ranti ne touche jamais mon argent » remonté dans le hero ;
  piliers et étapes resserrés (3 étapes au lieu de 5).
- Nettoyage : variante `declared` de StatusBadge devenue morte, supprimée ;
  dernier warning lint (variable inutilisée dans un test) corrigé.

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
