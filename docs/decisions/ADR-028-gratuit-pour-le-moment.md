# ADR-028 — Gratuit pour le moment, prix retiré de la surface publique

## Statut

Accepté — 2026-08-06 (décision CEO, en session). Supersède le **point 2 d'ADR-024**
(grille d'abonnement B-1 affichée) comme cible immédiate. Ne touche ni le point 1
(non-custodial) ni le point 3 (rail custodial gelé) d'ADR-024, qui restent en vigueur.

## Contexte

ADR-024 avait remplacé la commission 5 % par un abonnement par paliers
(0 / 4 900 / 14 900 F, grille B-1 du Master Blueprint) et l'a affiché sur la
landing et dans les CGU.

Trois constats à la relecture du 2026-08-06 :

1. **Aucune facturation n'existe.** Pas de prestataire de paiement dans le code
   (aucun Stripe, Paddle ou équivalent), aucun paywall, aucune limite par palier.
   Les prix ne vivent que comme **texte** dans `landing.tsx` et
   `conditions/page.tsx`. Il n'y a donc pas de système à retirer, seulement une
   **promesse de prix**.
2. **Le produit n'est pas encore utile au propriétaire.** Facturer suppose une
   valeur livrée et vérifiée. Elle ne l'est pas : la traction reste nulle et la
   phase en cours est l'entretien des premiers bailleurs
   (ADR-024 §5, « méthode avant code »).
3. **Une grille tarifaire non honorable coûte de la confiance.** Sur un marché
   méfiant du mobile money (research-log 10/07), afficher un prix qu'aucun
   système ne peut prélever crée une promesse creuse — l'inverse de l'actif que
   Ranti défend (« Ranti ne touche jamais l'argent »).

## Décision

1. **Ranti est gratuit, sans limite de logements, jusqu'à nouvel ordre.** Le
   palier « 1 logement » disparaît comme condition : le registre complet
   (échéances, relances, quittances) est ouvert à tous les propriétaires.

2. **La grille B-1 est retirée de la surface publique** — landing (`#tarifs`,
   `TIERS`, `TierCard`) et CGU (article 8). Aucun prix affiché, aucun palier,
   aucun vocabulaire d'abonnement.

3. **L'abonnement reste l'intention de monétisation**, pas une promesse datée.
   ADR-024 §2 garde sa valeur de cap (abonnement plutôt que commission), mais
   sans grille publique ni échéance tant que l'utilité n'est pas démontrée
   auprès des premiers utilisateurs réels.

4. **Engagement de préavis.** Le jour où un prix apparaît, les propriétaires
   déjà inscrits sont prévenus **avant**. Rien n'est jamais prélevé sans accord
   explicite : pas de carte enregistrée, rien à résilier. Cette phrase est tenue
   par la landing et par les CGU.

5. **Non-custodial et rail gelé inchangés.** Les fonds ne transitent jamais par
   Ranti (ADR-024 §1). Le ledger `payment_transactions`, le calcul de frais
   (`fees.ts`, split fiscal TVA d'ADR-018 v5) et le webhook restent en place,
   gelés derrière leur flag, sans surface utilisateur (ADR-024 §3). Rien n'est
   supprimé : la remise en route reste conditionnée à une traction prouvée et à
   un montage d'externalisation art. 7.

## Conséquences

- La landing répond « combien ça coûte » par : gratuit aujourd'hui, ça changera
  un jour, vous serez prévenu avant. Pas de date, pas de palier, pas de carte.
- Les CGU (article 8) décrivent un service gratuit et le préavis, au lieu d'une
  formule payante « indiquée au moment de la souscription ».
- La FAQ ne promet plus « un abonnement simple, gratuit pour un seul logement ».
- Le Master Blueprint (Notion) doit être réaligné : la grille B-1 y reste comme
  hypothèse de monétisation, non comme offre courante.
- Aucune migration, aucun changement de schéma : la décision est une surface
  publique et un document, pas un changement de produit.
