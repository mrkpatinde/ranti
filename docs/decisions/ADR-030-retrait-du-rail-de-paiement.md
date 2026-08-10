# ADR-029 — Retrait du rail de paiement : suppression plutôt que gel

## Statut

Accepté — 2026-08-09 (décision CEO, en session). Supersède **ADR-018**
(cœur transactionnel Kkiapay), **ADR-019** (rail FeexPay obligatoire),
**ADR-021** (montage wallet et reçus locataire côté rail) et la **disposition 3
d'ADR-024**, qui prévoyait de geler le rail derrière un flag désactivé plutôt
que de le supprimer.

Restaure **ADR-009** (alias de paiement du bailleur) comme chemin
d'encaissement unique et documenté. Complète **ADR-028** (pivot entreprises de
gestion).

## Contexte

ADR-024 avait, le 17 juillet 2026, ramené Ranti au non-custodial et décidé de
conserver le rail « derrière un flag désactivé, comme option future ». Le
constat du 9 août 2026, dépôt et base de production à l'appui, montre que ce
gel n'a jamais eu lieu :

- le webhook `POST /api/payments/notification` était câblé et opérationnel ;
- la table `payment_transactions` portait une commission de 5 % et un split de
  TVA à 18 %, avec ses CHECKs arithmétiques ;
- les RPC `ingest_payment_notification`, `verify_payment_transaction`,
  `reject_payment_transaction` et `mark_payment_transaction_paid_out`
  existaient et étaient exécutables ;
- les couches applicatives `src/lib/feexpay/` et `src/lib/payments/` étaient
  présentes, avec leurs variables d'environnement.

Aucune de ces surfaces n'était protégée par un interrupteur. Le seul frein
effectif était l'absence de compte marchand.

Dans le même dépôt, les conditions générales d'utilisation (art. 3) et la
politique de confidentialité (art. 5) affirment que Ranti ne reçoit, ne détient
et ne transfère jamais les loyers, et qu'aucun prestataire de paiement
n'intervient dans la relation. Deux sources de vérité du même dépôt se
contredisaient sur le point le plus sensible du produit : le rapport à l'argent
des utilisateurs.

L'arbitrage porte donc sur le sens de l'alignement. Les documents contractuels
engagent Ranti vis-à-vis de ses utilisateurs et sont publiés ; le code du rail
n'a jamais servi une seule transaction. C'est le code qui a été aligné sur le
contrat.

## Décision

### 1. Le rail est supprimé, pas mis derrière un flag

Migration `20260809120000_drop_payment_rail` : suppression des tables
`payment_transactions` et `payment_proofs`, et des quatre RPC du rail, avec
balayage des surcharges résiduelles (cinq redéfinitions successives dans
l'historique).

Côté application : suppression de `src/lib/feexpay/`, `src/lib/payments/` et
`src/app/api/payments/`.

Un flag désactivé conserve le code, ses dépendances, ses secrets
d'environnement, sa surface d'attaque et sa charge de maintenance à chaque
migration, pour une fonctionnalité qu'aucune décision n'autorise à activer.
Trois semaines de gel nominal ont produit zéro protection effective. La
suppression est la seule forme de désactivation qui se vérifie.

### 2. L'encaissement reste non-custodial

Le loyer circule directement du locataire à l'agence : espèces, Mobile Money,
virement, ou alias de paiement enregistré en `landlords.payment_alias`, qui est
le numéro marchand de l'agence. Cette colonne n'est pas touchée par la
migration.

Ranti enregistre, rapproche et atteste. Aucun compte, aucun wallet et aucun
sous-compte au nom de Ranti n'entre dans la chaîne de paiement.

### 3. La réversibilité passe par l'historique git

Les cinq migrations d'origine du rail restent lisibles dans l'historique. Un
retour éventuel se ferait sur une base de décision nouvelle, pas sur du code
dormant.

### 4. Le sujet PSP se limite à l'abonnement

Encaisser l'abonnement de Ranti met en jeu la recette propre de l'éditeur, pas
des fonds de tiers. Ce chantier reste ouvert et sans rapport avec le rail
supprimé.

## Pourquoi le modèle non-custodial est retenu

**Aucun agrément à chercher.** La détention transitoire de fonds de tiers
qualifie potentiellement l'établissement de paiement au sens de l'Instruction
BCEAO n° 001-01-2024 (art. 4, 9, 11 et 30). Sans détention, Ranti sort du champ.
Le gate juridique qui bloquait ADR-018 et ADR-019 depuis le 14 juillet
disparaît avec son objet, de même que la recherche d'un montage
d'externalisation art. 7 sous l'agrément d'un tiers.

**Aucune trésorerie tierce à porter.** Pas de fonds de locataires en transit,
pas de rapprochement entre encaissements et reversements, pas de calendrier de
payout à tenir, pas de risque de rupture de règlement si un prestataire tombe.
Le passif financier d'une plateforme custodial est sans commune mesure avec le
prix d'un abonnement de gestion.

**L'agence garde sa relation bancaire.** Le pivot vers les entreprises de
gestion (ADR-028) durcit cet argument. Une agence a déjà un compte marchand, une
banque, un comptable et des mandats qui l'obligent à reverser à ses
propriétaires. Entrer dans son flux d'argent revient à lui demander de changer
sa plomberie bancaire pour acheter un outil de clôture. Le modèle non-custodial
retire cette objection de la vente.

**Le contrat public redevient exact.** Ce que les CGU et la politique de
confidentialité décrivent correspond désormais à ce que la base et le code
exécutent.

## Conséquences

- Les écarts 1 et 2 des « écarts ouverts » de `BUILD_STATUS.md` (rail décidé
  FeexPay contre webhook implémenté Kkiapay ; gate BCEAO non levé) sont clos
  par disparition de leur objet.
- Les entrées « Paiements (ADR-018) » de `TODOS.md` sont retirées, y compris la
  validation juridique du montage PSP, le compte sandbox FeexPay, la surface de
  validation, la fiscalité du ledger et le rate-limiting du webhook.
- `docs/api.md` perd le webhook PSP et l'exception d'idempotence portée par
  `(provider, provider_reference)` ; `docs/database.md` perd
  `payment_transactions` et `payment_proofs`.
- Les variables d'environnement `FEEXPAY_*` n'ont plus d'usage.
- **Vestiges d'énumération.** `rent_receptions.recorded_by` accepte toujours la
  valeur `'psp'` et `transactions.source` la valeur `'feexpay'` : ces valeurs
  n'ont plus aucun écrivain. Leur retrait suppose une migration de contrainte,
  inscrite au suivi.
- La preuve de paiement fournie par le locataire (capture Mobile Money, reçu
  bancaire) n'a plus de table dédiée : `payment_proofs` était orpheline, sans
  lecteur ni écrivain applicatif et sans ligne en production.

## Non-objectifs réaffirmés

Pas de wallet, pas de compte de cantonnement, pas de détention même
transitoire, pas de commission sur les loyers, pas d'agrément bancaire, pas de
recouvrement.

## Supersède / restaure

- **Supersède** ADR-018, ADR-019, ADR-021, et la disposition 3 d'ADR-024.
- **Restaure** ADR-009 comme chemin d'encaissement unique et documenté.
- **Confirme** la disposition 1 d'ADR-024 (Ranti est et reste non-custodial) et
  sa disposition 2 (monétisation par abonnement).
