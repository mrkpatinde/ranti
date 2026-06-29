# Ranti — Principes Produit et Techniques

## Statut

Accepté comme base de travail initiale.

Ce document définit les règles qui empêchent Ranti de redevenir lourd, confus ou fragile.

## Principe 1 — Compréhension immédiate

Ranti doit être compris en moins de 5 secondes par un propriétaire africain qui gère ses loyers avec un registre, WhatsApp ou sa mémoire.

## Principe 2 — Problème unique

Ranti répond d'abord à une seule question :

> Qui a payé, qui n'a pas payé, quelle relance doit partir et quelle preuve existe ?

Tout ce qui ne renforce pas cette réponse est exclu du MVP.

## Principe 3 — Registre actif

Ranti n'est pas seulement un registre passif.

Le propriétaire renseigne le bail ou l'accord locatif. Ranti utilise ces règles pour générer les échéances, préparer ou automatiser les rappels et relances, et donner au propriétaire une vision claire du cycle de loyer.

## Principe 4 — Validation humaine, automatisation documentaire

Pour le MVP, le propriétaire reste la personne qui valide qu'un paiement a réellement été reçu.

Ranti n'invente pas un paiement, ne confirme pas une réception sans validation, et ne remplace pas la relation propriétaire-locataire.

Après validation du paiement par le propriétaire, Ranti génère automatiquement le document adapté : reçu partiel ou quittance/reçu complet.

## Principe 5 — Fiabilité avant envoi automatique

Ranti peut préparer automatiquement les rappels et relances dès le MVP.

L'envoi automatique complet via WhatsApp, SMS ou email doit rester contrôlé par les contraintes techniques, les coûts, l'opt-in et la fiabilité du canal.

La preuve et l'historique ne doivent jamais dépendre d'un prestataire externe.

## Principe 6 — Paiements hors Ranti acceptés

Un paiement peut être fait hors de Ranti : cash, Mobile Money, virement ou autre moyen local.

Ranti trace la réception validée, l'allocation à l'échéance, le solde restant et le document généré.

## Principe 7 — Mobile-first réel

Ranti doit être utilisable correctement depuis un téléphone.

Le produit doit fonctionner pour des utilisateurs qui ne passent pas leur journée sur ordinateur.

## Principe 8 — Simplicité radicale

Chaque écran doit avoir une intention principale.

Chaque action doit réduire la confusion du propriétaire.

Chaque fonctionnalité doit être justifiée par un usage mensuel réel.

## Principe 9 — Pas de dette produit volontaire

Une fonctionnalité séduisante mais non essentielle va dans la liste "Plus tard".

Le MVP ne doit pas devenir :

- un CRM immobilier ;
- une marketplace ;
- un outil comptable complet ;
- une banque ;
- une messagerie ;
- une agence de recouvrement ;
- un tableau de bord analytique avancé.

## Principe 10 — Domaine avant écrans

Ranti est conçu à partir du domaine métier avant d'être conçu à partir des écrans.

Nous définissons d'abord les concepts : propriétaire, bien, unité, locataire, bail, échéance, paiement, preuve, reçu, quittance, relance.

Les écrans viennent ensuite.

## Principe 11 — Source de vérité documentaire

Les décisions importantes doivent être écrites dans le dépôt.

Une décision qui reste seulement dans une conversation n'est pas considérée comme stable.

## Principe 12 — Sécurité et confiance dès le départ

Ranti manipule des données sensibles : loyers, identités, preuves de paiement, retards, reçus et quittances.

Le produit doit être construit avec des règles minimales de sécurité dès le début : permissions, séparation des données, historique des actions et accès contrôlés.

## Principe 13 — Terrain avant sophistication

Aucune sophistication produit ne doit remplacer le contact avec les vrais utilisateurs.

Les décisions importantes doivent être confrontées au terrain : propriétaires, locataires, gestionnaires locaux, pratiques cash, Mobile Money, reçus papier et WhatsApp.

## Principe 14 — Utilité mensuelle

Ranti doit créer de la valeur chaque mois.

Si un propriétaire n'a aucune raison d'ouvrir ou d'utiliser Ranti pendant le cycle de loyer, la fonctionnalité n'est pas prioritaire.
