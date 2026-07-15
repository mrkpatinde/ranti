# ADR-018 — Cœur transactionnel Kkiapay (ledger avec frais)

## Statut

Accepté (2026-07-14). Décision CEO en session : Ranti entre dans le flux
d'argent via Kkiapay. **Activation en production conditionnée à la validation
juridique BCEAO (voir « Caveat juridique »).**

Révisé le 2026-07-14 (même jour, CEO) — v2 : (a) les frais PSP Kkiapay
(1,9 %) sont payés par le **locataire** côté widget et ignorés par notre
système ; la commission Ranti passe à **3,0 %** (configurable) prélevée sur le
brut ; (b) `verified` = **validation par le propriétaire** (l'auto-confirm
webhook de la v1 est abandonné — le webhook ne fait qu'ingérer) ; (c) le
reversement devient un statut de la machine à états (`paid_out`) au lieu d'un
champ séparé.

Révisé le 2026-07-14 — v3 (après étude comparative des PSP, voir section
« Choix du PSP ») : 3,0 % total = **frais PSP + commission Ranti**, les deux
prélevés sur le brut et archivés séparément sur chaque ligne du ledger
(retour au modèle deux composants). Défauts alignés sur la recommandation
FedaPay : **1,8 % PSP (180 bp) + 1,2 % Ranti (120 bp)** — à verrouiller à la
signature du contrat PSP. Architecture « Ranti = interface » : les fonds
vivent dans le wallet marchand chez le PSP agréé, Ranti n'exécute que des
appels API (cash-in locataire → wallet PSP → payout du net au propriétaire).

Révisé le 2026-07-14 — v4 (CEO) : modèle économique **« All-Inclusive 5 % »**
(migration `20260714230000_all_inclusive_5pct`). Deux visions sur chaque
transaction, séparées **en base** par des grants au niveau colonne :

- **Vision reçu (propriétaire)** : `service_fee` = 5 % du brut (500 bp), tout
  compris — `net_amount` = 95 % reversé. C'est tout ce que le propriétaire
  voit ; les frais PSP ont disparu de son reçu.
- **Vision comptabilité (interne, service_role uniquement)** : les frais PSP
  deviennent des **dépenses de Ranti** — `payin_cost` sur le brut,
  `payout_cost` sur le net reversé, `net_margin = service_fee − payin_cost −
  payout_cost` = rentabilité réelle par transaction, suivie en temps réel.
  **Décision CEO (2026-07-14) : FeexPay retenu** (« le moins cher sur tous
  les plans » — appréciation terrain intégrant des éléments hors grille
  publique). Défauts : 170 bp payin, 100 bp payout → marge nette ≈ 2,35 %.
  Taux archivés par ligne : un changement de PSP resterait sans impact sur
  l'historique.
  `net_margin` peut être négatif : information de pilotage, pas une erreur.

Exemple canon (100 000 F) : reçu = 5 000 / 95 000 ; compta = 1 700 + 950 →
marge 2 350. TS : `calculateTransactionDetails(grossAmount)` (miroir de
`private.compute_transaction_details`).

Supersède partiellement ADR-009 (la position « Tier 1 uniquement, Ranti ne
détient jamais les fonds » n'est plus la cible produit ; l'alias P2P reste le
filet universel). Amende ADR-017 (voir « Auto-confirmation »).

## Contexte

ADR-009 a posé le Tier 1 : alias de paiement P2P, l'argent circule hors Ranti,
aucun agrément requis. Limites constatées sur le terrain : pas de preuve
automatique du paiement, pas de monétisation transactionnelle, réconciliation
manuelle (collage SMS, ADR-014).

Kkiapay est un agrégateur de paiement béninois (MTN MoMo, Moov, cartes) avec
checkout hébergé et webhooks signés. En passant l'encaissement par Kkiapay,
Ranti obtient un événement de paiement fiable (rail vérifié, pas une saisie
humaine) et peut prélever des frais de service.

## Décision

Construire un **ledger transactionnel** (`payment_transactions`) alimenté par
le webhook Kkiapay, avec frais calculés côté serveur et reversement du net au
propriétaire.

### Choix du PSP (v3 — étude comparative 2026-07-14)

Sources : kkiapay.me/tarifs, fedapay.com/pricing, feexpay.me/pricing,
docs.fedapay.com, docs.feexpay.me, docs.kkiapay.me (lus le 14/07/2026).

| Critère (Bénin) | Kkiapay | **FedaPay (reco)** | FeexPay |
|---|---|---|---|
| Abonnement | 14 900 F/mois (Intégration) | 0 | 0 |
| Cash-in MoMo | 1,5 % (charge client) | **1,8 %** (charge marchand) | 1,7 % (charge client) |
| Payout API vers MoMo d'un tiers | ❌ absent de l'offre standard (reversement = retrait manuel vers son propre compte, paliers, min 50 000 F ; « Push » séparé à 10 000 F/mois) | ✅ **`POST /v1/payouts`, 0 F via MoMo** | ✅ API payout mais **1 %** de frais |
| Webhooks / sandbox / montants entiers | oui | oui (+ `merchant_reference` idempotente, champ description « exigences BCEAO ») | oui (V2 : payout PENDING → polling statut) |

**Décision : FedaPay.** Seul PSP avec payout programmatique **gratuit** vers
le MoMo d'un tiers, zéro coût fixe, le moins cher sur le cycle complet
cash-in → cash-out (1,8 % all-in). Kkiapay est disqualifié par l'absence de
cash-out API (le reversement standard ne va que vers le compte du marchand).
FeexPay est le repli (payin 1,7 % mais à la charge du locataire — il paierait
plus que son loyer — et payout à 1 %).

### Frais — 3,0 % total, deux composants (v3)

- **Cash-in** : le locataire paie exactement 100 % du loyer (pas de
  sur-facturation côté widget). Les frais PSP sont prélevés sur le brut.
- **Répartition** : `psp_fee = floor(montant × psp_bp / 10000)` et
  `platform_fee = floor(montant × platform_bp / 10000)`. Défauts : **180 bp
  PSP + 120 bp Ranti = 300 bp** — taux **stockés sur chaque ligne**
  (`psp_fee_bp`, `platform_fee_bp`) : configurables sans invalider
  l'historique ni les contraintes CHECK. À verrouiller au contrat PSP.
- **Cash-out** : `net_amount = montant − psp_fee − platform_fee` = 97 % au
  propriétaire (déterministe, XOF entier — jamais de flottants ; le reste
  d'arrondi ≤ 1 FCFA par composant revient au propriétaire). Le ledger
  balance exactement par construction. Payout FedaPay vers MoMo : 0 F.

### Machine à états

`pending → verified → paid_out`, avec `rejected` terminal depuis `pending`.
Aucun retour en arrière. Un paiement dont le montant ne correspond pas au
loyer du bail actif est enregistré `rejected` avec `rejection_reason` — jamais
droppé (complétude du ledger, réconciliation).

| Statut | Signification | Transition par |
|---|---|---|
| `pending` | paiement initié par le locataire (webhook ingéré) | RPC ingest (service_role) |
| `verified` | **validé par le propriétaire** → réception + quittance | RPC verify (authenticated, garde ownership) |
| `paid_out` | reversement du net effectué | RPC mark_paid_out (ops, service_role) |
| `rejected` | montant inattendu / bail inactif / rejet explicite | ingest ou reject |

Règle de montant : le rail Kkiapay exige le **match exact**
`amount_received = leases.monthly_rent_amount` (le montant est fixé côté
serveur au moment du checkout ; un écart = altération ou lien périmé). Le flux
manuel existant (encaissements partiels, allocations) est inchangé.

### Aucune voie d'écriture parallèle (ADR-017 respecté)

Une transaction `verified` crée la réception via le pipeline existant :
`private.record_collection_core` (montant **brut** — la quittance certifie ce
que le locataire a payé ; frais et net ne vivent que sur le ledger) →
`private.confirm_collection_core` → `private.generate_receipt_core`, dans la
même transaction Postgres. `recorded_by = 'psp'`,
`payment_reference = référence Kkiapay` (déduplication cross-rail avec le
collage SMS via l'index unique partiel existant).

### Validation par le propriétaire (v2 — ADR-017 pleinement respecté)

La v1 auto-confirmait sur preuve du rail signé. **Révision CEO du même jour :
la validation humaine du propriétaire reste obligatoire**, exactement comme
ADR-017 le posait : le webhook **ingère seulement** (`pending`), le
propriétaire valide depuis l'app (`verified`), et c'est cette validation qui
déclenche le pipeline réception → confirmation → quittance (ADR-007 : le
document est la conséquence de la validation). La contestation locataire
(ADR-013) reste le filet aval.

### Sécurité

- Écritures du ledger **uniquement** via RPC `SECURITY DEFINER`. Ingest /
  reject / mark_paid_out : `service_role` seul (précédent :
  `ops_confirm_collection`). Verify : accordée à `authenticated` avec **garde
  d'appartenance explicite** (`landlord_id = private.current_landlord_id()`,
  précédent : RPC token ADR-013). Aucun grant INSERT/UPDATE/DELETE client sur
  la table ; `authenticated` a SELECT (RLS par propriétaire).
- Invariants arithmétiques en contraintes CHECK — inviolables même par une RPC
  boguée. Le calcul TS (`fees.ts`) n'est qu'un miroir d'affichage : la base
  fait autorité.
- Webhook `POST /api/payments/notification` : HMAC-SHA256 sur le corps brut,
  comparaison à temps constant, idempotent sur `(provider, provider_reference)`.
- Zéro IA dans ce chemin de code : logique pure déterministe.

### Reversement (payout)

Hors périmètre pour l'automatisation. `verified → paid_out` (+ `paid_out_at`)
basculé manuellement par les ops après reversement du net au propriétaire.

## Caveat juridique (BCEAO) — bloquant avant production

Posture v3 : **Ranti reste l'interface, le PSP agréé (FedaPay) détient les
fonds.** Les fonds ne transitent jamais par un compte bancaire de Ranti : ils
vont du locataire au wallet marchand chez le PSP, puis du wallet au MoMo du
propriétaire via l'API payout. Ranti n'exécute que des appels API et prélève
sa commission.

Reste à faire valider par conseil juridique au regard de l'**Instruction
BCEAO n° 001-01-2024** (analyse du 2026-07-10) : le wallet marchand est au
nom de Ranti, donc l'« encaissement pour compte de tiers » peut encore
qualifier un service de paiement (art. 4, agrément préalable art. 9 ; art. 30 :
même les simples initiateurs ne peuvent détenir les fonds du payeur ; capital
minimum initiation seule 20 M FCFA, art. 11). Pistes de sécurisation par coût
croissant : (1) **partenariat/externalisation art. 7 avec le PSP agréé**
(FedaPay) — cadre contractuel où le PSP porte la responsabilité
réglementaire ; (2) sous-comptes/wallets au nom de chaque propriétaire si le
PSP le permet ; (3) agrément propre. À faire valider **avant toute activation
en production**. D'ici là : sandbox uniquement, feature non exposée aux
utilisateurs.

## Conséquences

- Preuve de paiement automatique (plus de collage pour les baux sur ce rail).
- Monétisation transactionnelle : commission Ranti 1,2 % (120 bp, configurable
  par ligne) + frais PSP 1,8 % (180 bp) = 3,0 % sur le brut.
- Posture v3 : Ranti = interface, jamais détenteur — les fonds vivent dans le
  wallet marchand au nom de Ranti chez le PSP (caveat BCEAO ci-dessus), et le
  processus ops de reversement reste à outiller.
- L'alias P2P (ADR-009) et le collage SMS (ADR-014) restent les filets
  universels pour les propriétaires sans rail connecté.

## Hors périmètre (cet ADR)

- Automatisation du reversement (payout FedaPay — ou PSP retenu au contrat).
- Surface checkout locataire (widget sur la page `/confirmer`) et vue
  `/transactions` propriétaire — le ledger est prêt à les accueillir.
- Autres PSP (Wave, MTN Collections direct) : le schéma accepte déjà
  `('fedapay', 'feexpay', 'kkiapay')` (default `'fedapay'`), mais un seul rail
  sera câblé tant qu'un second n'est pas contractualisé.
