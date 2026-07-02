# Ranti — Principes

## Statut

Version 2.0 — source unique des principes produit et techniques.

Ce fichier remplace `docs/product-principles.md`, qui doit rester un renvoi ou être supprimé.

## Rôle

Ces principes empêchent Ranti de redevenir lourd, confus ou fragile.

Ils guident les décisions produit, design, domaine, architecture et implémentation.

## Principe 1 — Le terrain gagne toujours

Ranti se construit à partir de la réalité vécue par les propriétaires.

Lorsqu'une hypothèse est contredite par le terrain, c'est le terrain qui gagne.

Une intuition non validée reste une hypothèse.

## Principe 2 — Problème unique

Ranti doit d'abord répondre clairement à cette question :

> Qui a payé, qui est en retard, quelle relance doit partir et quelle preuve existe ?

Tout ce qui ne renforce pas cette réponse est exclu du MVP.

## Principe 3 — Registre actif

Ranti n'est pas seulement un registre passif.

Le propriétaire renseigne le bail ou l'accord locatif. Ranti utilise ces règles pour générer les échéances, préparer ou automatiser les rappels et relances, puis conserver les preuves après validation des paiements.

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

## Principe 7 — Domaine avant écrans

Ranti est conçu à partir du domaine métier avant d'être conçu à partir des écrans.

Nous définissons d'abord les concepts : propriétaire, bien, logement, locataire, bail, échéance, paiement, preuve, reçu, quittance, relance.

Les écrans viennent ensuite.

## Principe 8 — Simplicité radicale

La simplicité est une fonctionnalité.

Chaque écran doit avoir une intention principale.

Chaque action doit réduire la confusion du propriétaire.

Chaque fonctionnalité doit être justifiée par un usage mensuel réel.

## Principe 9 — Mobile-first réel

Ranti doit être utilisable correctement depuis un téléphone.

Le produit doit fonctionner pour des utilisateurs qui ne passent pas leur journée sur ordinateur.

## Principe 10 — Langage du propriétaire

L'interface utilise les mots naturels du propriétaire.

Le modèle métier peut utiliser un vocabulaire plus précis, mais l'interface doit rester compréhensible.

Utiliser "registre de loyer".

Ne pas utiliser "cahier de loyer".

## Principe 11 — Confiance avant fonctionnalités

Ranti manipule des données sensibles : loyers, identités, preuves de paiement, retards, reçus et quittances.

Le produit doit être fiable, vérifiable et traçable avant d'être riche.

Chaque information importante doit être claire, cohérente et explicable.

## Principe 12 — Le propriétaire garde le contrôle

Ranti accompagne, prépare et automatise quand cela apporte de la valeur.

Mais Ranti ne prend pas une décision importante à la place du propriétaire.

Le propriétaire reste maître de son patrimoine et de ses relations locatives.

## Principe 13 — Pas de dette produit volontaire

Une fonctionnalité séduisante mais non essentielle va dans la liste "Plus tard".

Le MVP ne doit pas devenir :

- un CRM immobilier ;
- une marketplace ;
- un outil comptable complet ;
- une banque ;
- une messagerie ;
- une agence de recouvrement ;
- un tableau de bord analytique avancé ;
- un portail locataire complet.

## Principe 14 — Source de vérité documentaire

Les décisions importantes doivent être écrites dans le dépôt.

Une décision qui reste seulement dans une conversation n'est pas considérée comme stable.

GitHub est la source officielle de vérité.

## Principe 15 — Utilité mensuelle

Ranti doit créer de la valeur chaque mois.

Si un propriétaire n'a aucune raison d'ouvrir ou d'utiliser Ranti pendant le cycle de loyer, la fonctionnalité n'est pas prioritaire.

## Question de référence

Avant d'ajouter une fonctionnalité, demander :

> Cette fonctionnalité aide-t-elle réellement le propriétaire à suivre ses loyers, éviter les oublis, relancer proprement ou conserver une preuve fiable ?

Si la réponse est non, elle n'entre pas dans le MVP.
