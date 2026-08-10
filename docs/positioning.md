# Ranti — Positionnement & Voix

Source de vérité pour la communication. Dernière mise à jour : 2026-08-09
(ADR-029, pivot entreprises de gestion ; ADR-030, retrait du rail de paiement).

## Catégorie

Le système opérationnel des entreprises de gestion immobilière. Ranti tient le
registre locatif d'un portefeuille de lots, prépare les relances, édite les
quittances et produit la clôture mensuelle que l'agence doit à ses mandants.

Ce que Ranti ne fait pas : encaisser, détenir des fonds, arbitrer un litige,
tenir une comptabilité générale.

## Le client

L'entreprise de gestion immobilière au Bénin, puis en zone UEMOA : agence
immobilière, administrateur de biens, gestionnaire indépendant qui administre
les lots d'autrui sous mandat. Le compte connecté est l'agence.

Un bailleur qui gère ses propres biens peut utiliser le produit. Il ne dicte
plus les arbitrages.

## Le cœur (ce qu'on vend)

> **La fin du mois, tenue.** Ce qui a été encaissé sur chaque lot, ce qui a été
> retenu en honoraires, ce qui revient à chaque propriétaire — dans un document
> qui s'additionne à la main.

La clôture mensuelle occupe trois à cinq jours par mois chez un administrateur
de biens, sur Excel et WhatsApp. C'est le moment où Ranti remplace un travail
existant, pas un moment où il en ajoute un.

## Le propriétaire mandant

Le mandant n'utilise pas Ranti. Il reçoit chaque mois un relevé produit par
Ranti et remis par son agence. Ce document circule chez des personnes qui
possèdent des biens et qui ont, elles aussi, un gestionnaire. Chaque compte
gagné met en circulation autant de relevés qu'il y a de mandants au
portefeuille.

## Une phrase (comprise en 5 secondes)

- « Votre clôture du mois, tenue. »
- « Ce que vous devez à chaque propriétaire, calculé. »
- « Soixante lots, une passe de relances. »

## Ce que « premium » veut dire ici

Le calme et l'autorité d'un document qui fait foi — la sobriété d'un registre
de notaire. Un relevé remis à un propriétaire engage la réputation de l'agence
devant son mandant ; il doit avoir l'air de ce qu'il est. Dans un marché
méfiant du mobile money, la sobriété est un actif de confiance.

## La voix, en 4 règles

1. Les mots du métier, jamais le jargon logiciel. Lot, bail, échéance, mandant,
   honoraires, clôture, quittance. Jamais « plateforme », « automatisé »,
   « SaaS », « IA », « wallet ».
2. Le calme fait le premium. Phrases courtes, affirmatives. Ranti constate.
3. Ranti parle à la place du gestionnaire. Le ton des relances est neutre et
   respectueux : c'est le registre qui parle, ce qui dédouane la personne qui
   envoie.
4. Le produit prouve, il n'explique pas. Un écran qui a besoin d'un mode
   d'emploi est raté.

## Là où Ranti parle pour lui-même (les 3 artefacts)

**Hero de la landing**
> **Votre portefeuille, au clair. Votre clôture, tenue.**
> Ranti suit les loyers de tous vos lots, relance vos locataires en une passe,
> édite vos quittances et produit le relevé mensuel de chaque propriétaire.
> L'argent va directement chez vous.

**Message de relance** (impersonnel, signé du registre, zéro culpabilisation)
> Bonjour [Prénom]. Le loyer de [lot] pour [période] reste dû : [montant].
> — [Agence], via Ranti

**Relevé propriétaire** (l'artefact qui circule — porte la marque jusqu'au
mandant)
> Relevé de gestion · [mois] · encaissé, honoraires, net à reverser · édité via
> Ranti

## Ce qu'on ne dit jamais

« Banque », « wallet », « gérer votre argent », « paiement en ligne », et tout
jargon technique. Ranti garde les preuves ; il ne touche pas les fonds
(ADR-030).
