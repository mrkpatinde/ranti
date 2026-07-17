# ADR-021 — Retour au non-custodial, abonnement, tête de pont diaspora

## Statut

Accepté — 2026-07-17 (décision CEO + co-founder, en session). Supersède **ADR-018**
et **ADR-019** comme cible produit. Restaure **ADR-009** (non-custodial) comme
chemin principal.

## Contexte

ADR-018 (cœur transactionnel) puis ADR-019 (rail FeexPay unique) avaient fait
entrer Ranti dans le flux d'argent : encaissement via wallet marchand au nom de
Ranti, commission 5 %, reversement du net. Cette cible produit était **bloquée par
le gate BCEAO** (détention transitoire → établissement de paiement, Instruction
001-01-2024), jamais levé.

Trois constats ont motivé le retour arrière :

1. **Zéro traction.** La base de production compte 1 propriétaire de test, 0
   relance envoyée, 0 transaction. Aucune raison d'assumer le coût et le risque
   d'un rail custodial avant le premier utilisateur réel.
2. **Dérive des sources de vérité.** Le Master Blueprint (Notion) portait le
   non-custodial + abonnement ; les ADR 018/019 (repo) portaient le custodial +
   5 % ; le code implémentait Kkiapay. Trois stratégies contradictoires en 72 h.
3. **L'actif de confiance sacrifié.** L'OSINT (research-log 10/07) désigne « Ranti
   n'encaisse rien » comme argument de confiance n°1 dans un marché méfiant du
   mobile money. Le rail custodial détruisait cet actif pour une marge nette
   ≈ 2,35 % sur un rail non activable.

## Décision

1. **Ranti est et reste non-custodial.** Les fonds ne transitent jamais par un
   compte ou wallet au nom de Ranti. Le loyer circule directement locataire →
   propriétaire (cash, Mobile Money, virement, ou alias PI-SPI du propriétaire).
   La promesse « **Ranti ne touche jamais l'argent** » est restaurée en doc et
   dans l'app.

2. **Monétisation = abonnement par paliers** (grille B-1 du Master Blueprint :
   0 / 4 900 / 14 900 F, gratuit mono-logement comme nœud de la boucle de
   recommandation). La **commission transactionnelle de 5 % est abandonnée**.

3. **Le rail custodial (ADR-018 / ADR-019) est gelé, pas supprimé.** Le code
   (ledger `payment_transactions`, webhook, calcul de frais) reste en place
   derrière un flag désactivé, comme **option future** conditionnée à : (a) une
   traction abonnement prouvée, et (b) un montage d'**externalisation art. 7**
   sous l'agrément d'un PSP. **Jamais d'agrément propre. Jamais devenir la
   banque.** Référence assumée : le modèle néobanque (Moneco) roule sur un
   partenaire licencié — on prend sa **simplicité**, pas son bilan.

4. **Tête de pont = bailleur diaspora / à distance** (francophone). Même produit,
   wedge le plus aigu : confiance et preuve à distance, capacité de paiement en
   euros, cible atteignable via les communautés diaspora. L'auto-gérant local
   reste utilisateur, pas la pointe de lance.

5. **Méthode avant code.** Aucun nouveau développement produit avant **5
   entretiens de bailleurs diaspora / à distance** consignés au research-log.
   Standard YC = parler aux utilisateurs et livrer le wedge, pas empiler des
   features.

## Conséquences

- **Gate BCEAO neutralisé** pour le MVP : sans détention, Ranti sort du champ de
  l'Instruction 001-01-2024.
- **Code à réaligner** : le webhook Kkiapay en dur (`api/payments/notification`)
  devient du code mort à mettre derrière flag ; aucune surface d'encaissement
  custodial exposée.
- **PSP** : le sujet se réduit à l'encaissement de l'abonnement (recette propre de
  Ranti, pas de fonds tiers). FedaPay reste le meilleur choix le moment venu
  (`docs/comparatif-psp`).
- **Docs à mettre à jour** : `vision.md` (fait), `docs/roadmap.md`, `personas.md`
  (ajouter le bailleur à distance), Master Blueprint Notion (retirer la section
  rail). GitHub = source de vérité.
- **Positionnement** : voir `docs/positioning.md` (nouveau) — cœur « Ranti relance
  à votre place ».

## Non-objectifs réaffirmés

Pas de wallet, pas de rail d'encaissement obligatoire, pas de détention de fonds,
pas de recouvrement, pas de comptabilité, pas d'agrément bancaire.

## Supersède / amende

- **Supersède** ADR-018, ADR-019 (comme cible produit ; conservés comme option
  gelée derrière flag).
- **Restaure** ADR-009 (non-custodial, alias PI-SPI) comme chemin principal.
