# Ranti — Vision Produit

Dernière mise à jour : 2026-07-17 (réalignement sur ADR-021 — retour au non-custodial + abonnement).

## Positionnement

Ranti est le registre de loyer actif des propriétaires africains.

Il aide les propriétaires à suivre les loyers, identifier les retards, garder les preuves de paiement, automatiser les rappels et relances à partir du bail, puis générer automatiquement les reçus ou quittances après validation du paiement.

## Problème principal

Aujourd'hui, beaucoup de propriétaires suivent les loyers avec :

- un registre papier ;
- WhatsApp ;
- des appels ;
- des captures Mobile Money ;
- des reçus manuels ;
- ou leur mémoire.

Cela crée des oublis, des conflits, des paiements difficiles à vérifier, des relances tardives et un manque de visibilité.

## Promesse

Ranti permet au propriétaire de répondre rapidement à cinq questions :

1. Qui a payé ?
2. Qui n'a pas encore payé ?
3. Quelle preuve existe pour chaque paiement ?
4. Quelle relance est prévue ou déjà envoyée ?
5. Quel reçu ou quelle quittance a été généré après validation ?

## Boucle produit

Ranti suit une boucle simple :

1. le propriétaire renseigne le bail ou l'accord locatif ;
2. Ranti génère les échéances de loyer ;
3. Ranti prépare ou automatise les rappels et relances ;
4. le propriétaire valide les paiements reçus ;
5. Ranti génère automatiquement le reçu partiel ou la quittance adaptée ;
6. Ranti conserve l'historique des paiements, relances et preuves.

## Deux moteurs produit

### Reminder Engine

Le bail crée les échéances. Les échéances créent les rappels et relances.

Ranti ne dépend pas de la mémoire du propriétaire pour savoir quand rappeler ou relancer.

### Proof Engine

Le paiement validé crée la preuve.

Après validation propriétaire, Ranti génère automatiquement le document adapté : reçu de paiement partiel ou quittance/reçu complet quand l'échéance est soldée.

## Cible initiale

Propriétaires particuliers africains qui gèrent entre 1 et 20 logements.

**Tête de pont (ADR-021)** : le bailleur **diaspora / à distance** francophone — celui qui possède un bien au pays géré par un proche ou un démarcheur, sans visibilité ni preuve. Douleur de confiance la plus aiguë, capacité de paiement en euros, atteignable via les communautés diaspora. L'auto-gérant local reste utilisateur, mais n'est pas la pointe de lance de l'acquisition.

## Rapport à l'argent (ADR-021 — retour au non-custodial)

Cette section **annule** la position d'ADR-018 / ADR-019. La promesse
« **Ranti ne touche jamais l'argent** » est **restaurée** comme cible produit.

État décidé (ADR-021, 2026-07-17) :

- **Ranti ne détient jamais les fonds.** Le loyer circule directement du
  locataire au propriétaire (cash, Mobile Money, virement, ou alias PI-SPI du
  propriétaire — ADR-009 restauré comme chemin principal). Aucun wallet ni compte
  au nom de Ranti dans le flux.
- **Monétisation = abonnement par paliers** (0 / 4 900 / 14 900 F, grille Master
  Blueprint B-1 ; gratuit mono-logement = nœud de la boucle de recommandation).
  La commission transactionnelle de 5 % est **abandonnée**.
- La validation du paiement reste **humaine** : le propriétaire valide la
  réception, Ranti génère la preuve.
- Le **rail custodial (ADR-018 / ADR-019) est gelé, pas supprimé** : le code
  (ledger, webhook, calcul de frais) reste derrière un flag désactivé, comme
  **option future** conditionnée à (a) une traction abonnement prouvée et (b) un
  montage d'externalisation art. 7 sous l'agrément d'un PSP. **Jamais d'agrément
  propre, jamais devenir la banque.**

**Gate BCEAO — neutralisé pour le MVP.** Sans détention de fonds, Ranti n'entre
pas dans le champ de l'Instruction BCEAO n° 001-01-2024. Le sujet PSP se réduit à
l'encaissement de l'**abonnement** (recette propre de Ranti, pas de fonds de
tiers) — FedaPay est le meilleur choix le moment venu (voir `docs/comparatif-psp`).

## Non-objectifs du MVP

Ranti n'est pas :

- un CRM immobilier ;
- une marketplace immobilière ;
- un logiciel comptable ;
- **une banque** — pas d'agrément, pas de dépôt, pas de compte Ranti dans le
  flux, pas de crédit. **Ranti ne touche jamais l'argent** : le loyer va
  directement du locataire au propriétaire (ADR-021) ;
- une agence de recouvrement ;
- une application de gestion complexe ;
- un produit qui confirme des paiements sans validation humaine.

## Critère de réussite du MVP

Un propriétaire peut, chaque mois, suivre ses loyers sans registre papier et sans confusion.

Il voit les échéances, les retards, les relances prévues, les paiements validés et les reçus ou quittances générés automatiquement.

## Règle produit

Aucune fonctionnalité n'entre dans le MVP si elle ne simplifie pas l'une de ces actions :

- savoir qui a payé ;
- savoir qui est en retard ;
- savoir quelle relance doit partir ;
- valider un paiement reçu ;
- prouver qu'un paiement a été effectué ;
- générer automatiquement un reçu ou une quittance après validation.
