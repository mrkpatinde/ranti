# Ranti — Design Brief

## Statut

Version 1.1 — brief de conception, sans output visuel validé dans le repo.

Ce fichier décrit ce qu'il faut designer. Il ne prouve pas qu'une maquette existe.

## État des artefacts visuels

Aucun output Claude Design, Figma, image ou prototype visuel validé n'est actuellement documenté dans le repo.

Tant qu'un artefact visuel n'est pas lié ici, ce fichier reste un brief, pas une preuve de design.

## Livrables attendus

Les livrables design doivent être ajoutés ou référencés dans le repo sous une forme exploitable :

```txt
docs/design/
  dashboard-owner.md
  lease-detail.md
  payment-confirmation.md
  receipt-generated.md
  reminders.md
  screenshots/
```

Chaque livrable doit indiquer :

- source : Claude Design, Figma, capture, prototype code ;
- date ;
- statut : brouillon, retenu, rejeté, à tester ;
- écran concerné ;
- hypothèses UX ;
- décisions prises ;
- points à tester terrain.

## Positionnement

Ranti est le registre de loyer actif des propriétaires africains.

Le propriétaire renseigne les baux. Ranti suit les échéances, prépare ou automatise les rappels et relances, trace les paiements validés et génère automatiquement les reçus ou quittances adaptés.

## Cible

Propriétaires particuliers africains et petits gestionnaires simples, 1 à 20 logements.

Ils utilisent aujourd'hui registre papier, WhatsApp, appels, mémoire, captures Mobile Money, reçus manuels ou Excel basique.

## Principe UX central

En moins de 5 secondes, le propriétaire doit pouvoir identifier :

1. combien était attendu ce mois-ci ;
2. combien est déjà encaissé ;
3. combien reste à encaisser ;
4. qui est en retard ;
5. quelles relances sont prévues ou envoyées ;
6. quels reçus ou quittances ont été générés.

Ce principe reste une hypothèse UX tant qu'il n'a pas été testé avec des propriétaires.

## Deux moteurs produit

### Reminder Engine

À partir du bail et des échéances, Ranti prépare, planifie ou envoie les rappels et relances.

Le propriétaire configure les règles. Ranti exécute ou prépare selon le niveau d'automatisation disponible.

### Proof Engine

À partir d'un paiement validé par le propriétaire, Ranti génère automatiquement le document adapté.

Paiement partiel validé : reçu de paiement partiel.

Échéance soldée : quittance ou reçu complet.

## Écrans MVP à designer

1. Dashboard propriétaire
2. Onboarding : bien, logement, locataire, bail
3. Liste des locataires
4. Fiche locataire
5. Fiche bail
6. Échéances mensuelles
7. Validation de paiement
8. Reçu ou quittance généré
9. Retards et relances
10. Historique locataire

## Contraintes visuelles

- Mobile-first
- Français uniquement
- Peu de texte
- Pas de jargon SaaS
- Pas d'émojis
- Pas de CRM générique
- Pas de marketplace
- Pas de design bancaire lourd
- Sobre, clair, chaleureux, professionnel
- Priorité au propriétaire
- Utiliser "registre de loyer"
- Ne jamais utiliser "cahier de loyer"

## Dashboard attendu

Le dashboard doit montrer :

- loyers attendus ce mois ;
- déjà encaissé ;
- reste à encaisser ;
- retards ;
- relances prévues ;
- relances envoyées ;
- paiements récemment validés ;
- reçus ou quittances générés ;
- action principale : enregistrer ou valider un paiement.

## Fiche bail attendue

La fiche bail doit montrer :

- locataire ;
- logement ;
- montant du loyer ;
- période ;
- date d'échéance ;
- canal de contact ;
- rappel avant échéance ;
- relance après retard ;
- automatisation active ou suspendue.

## Écran validation paiement

L'écran doit rendre explicite que :

- le propriétaire confirme la réception ;
- Ranti mettra à jour l'échéance ;
- Ranti générera automatiquement le document adapté ;
- si le montant est partiel, ce sera un reçu partiel ;
- si la période est soldée, ce sera une quittance ou un reçu complet.

## Prompt Claude Design

```txt
Tu es Product Designer senior.

Contexte : Ranti est le registre de loyer actif des propriétaires africains. Le propriétaire renseigne le bail ; Ranti suit les échéances, prépare ou envoie les rappels, détecte les retards, et génère automatiquement les reçus ou quittances après validation du paiement par le propriétaire.

Objectif : concevoir une maquette mobile-first du MVP.

Contraintes : français simple, très peu de texte, pas de jargon SaaS, pas d'émojis, pas de CRM générique, pas de marketplace, pas de paiement intégré complexe, priorité aux propriétaires 1 à 20 logements.

Livrable : dashboard, onboarding bail, fiche locataire, fiche bail, validation paiement, reçu/quittance, retards/relances, historique.

Critère : le propriétaire doit comprendre la situation de ses loyers et les actions utiles en moins de 5 secondes.
```
