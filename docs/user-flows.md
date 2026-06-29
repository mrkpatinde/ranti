# Ranti — User Flows

## Statut

Version 2.0 — hypothèses de parcours à valider terrain.

Ce document ne décrit pas ce que l'utilisateur est censé ressentir.

Il décrit des situations observables, des actions attendues, les données nécessaires, les risques et les questions terrain à valider.

## Principe

Un user flow Ranti doit pouvoir être testé avec un vrai propriétaire.

Un flow est utile seulement s'il permet d'observer :

- ce que le propriétaire essaie de faire ;
- les informations qu'il comprend ou ne comprend pas ;
- l'action qu'il réalise ;
- les blocages ;
- la preuve que le flow répond à un problème réel.

## Statut de validation terrain

Aucune réponse terrain documentée n'est encore présente dans le repo.

Avant de considérer ces flows comme validés, il faut alimenter `docs/research-log.md` avec des entretiens, observations ou tests de maquette.

---

## Flow 1 — Comprendre Ranti

### Situation observable

Un propriétaire découvre Ranti depuis une landing page, un message WhatsApp, une recommandation ou une démonstration.

### Hypothèse

Le propriétaire comprend rapidement que Ranti sert à suivre les loyers, les retards, les relances et les preuves.

### Action attendue

Il décide soit de commencer, soit de demander plus d'informations, soit d'abandonner.

### Données nécessaires

Aucune donnée métier.

### Sortie attendue

Le propriétaire comprend la promesse sans explication longue.

### Risques

- Le produit semble trop proche d'un simple tableau.
- Le produit semble trop complexe.
- Le mot "registre de loyer" n'est pas compris partout.
- La promesse de relance automatique peut créer une inquiétude.

### Validation terrain

À vérifier : le propriétaire peut-il expliquer Ranti avec ses propres mots après 30 secondes ?

---

## Flow 2 — Créer son espace propriétaire

### Situation observable

Le propriétaire veut essayer Ranti.

### Hypothèse

Il accepte de créer un compte si l'effort est court et si le bénéfice est clair.

### Action attendue

Il saisit ses informations de base et accède à un espace vide.

### Données nécessaires

- téléphone ;
- mot de passe ;
- prénom / nom ou nom d'usage ;
- pays ou indicatif.

### Sortie attendue

Un propriétaire existe dans Ranti.

### Risques

- Le téléphone au format local est mal saisi.
- L'OTP ou le provider téléphone bloque l'inscription.
- L'utilisateur ne comprend pas quoi faire après l'inscription.

### Validation terrain

À vérifier : le propriétaire peut-il créer son espace sans aide en moins de 2 minutes ?

---

## Flow 3 — Ajouter une propriété

### Situation observable

Le propriétaire veut représenter un lieu qu'il possède ou gère.

### Hypothèse

Il pense d'abord en lieu ou maison, puis en logements.

### Action attendue

Il crée une propriété avec un nom simple.

### Données nécessaires

- nom de la propriété ;
- ville ou quartier ;
- adresse ou repère facultatif.

### Sortie attendue

La propriété est créée et prête à recevoir des logements.

### Risques

- Le propriétaire ne distingue pas toujours propriété, maison et logement.
- Le niveau de détail demandé peut être trop élevé.

### Validation terrain

À vérifier : les mots utilisés dans l'UI correspondent-ils à la manière dont le propriétaire parle de ses biens ?

---

## Flow 4 — Ajouter un logement

### Situation observable

Le propriétaire veut ajouter les unités louables d'une propriété.

### Hypothèse

Il peut nommer ses logements simplement : chambre 1, appartement A, boutique, magasin.

### Action attendue

Il crée un ou plusieurs logements rattachés à une propriété.

### Données nécessaires

- propriété ;
- nom du logement ;
- type de logement ;
- statut disponible ou occupé.

### Sortie attendue

Chaque logement peut ensuite recevoir un bail.

### Risques

- Trop de types de logement compliquent le choix.
- Certains propriétaires ne raisonnent pas par logement mais par locataire.

### Validation terrain

À vérifier : le propriétaire arrive-t-il à modéliser son bien réel sans contorsion ?

---

## Flow 5 — Ajouter un locataire

### Situation observable

Le propriétaire veut associer une personne à un logement occupé.

### Hypothèse

Le nom et le téléphone suffisent pour démarrer.

### Action attendue

Il crée un locataire.

### Données nécessaires

- prénom / nom ou nom d'usage ;
- téléphone facultatif mais recommandé ;
- notes facultatives.

### Sortie attendue

Le locataire peut être associé à un bail.

### Risques

- Le propriétaire n'a pas toujours le numéro exact.
- Le locataire peut avoir plusieurs noms d'usage.
- Le propriétaire peut vouloir ajouter un locataire sans créer de bail immédiatement.

### Validation terrain

À vérifier : quelles informations minimales les propriétaires ont réellement sur leurs locataires ?

---

## Flow 6 — Créer un bail ou accord locatif

### Situation observable

Le propriétaire veut définir les règles de paiement pour un locataire occupant un logement.

### Hypothèse

Le bail ou accord locatif peut être réduit au MVP à quelques informations : logement, locataire, montant, échéance, date de début et canal de contact.

### Action attendue

Il crée puis active un bail.

### Données nécessaires

- logement ;
- locataire ;
- montant mensuel ;
- devise ;
- date de début ;
- jour d'échéance ;
- canal de contact ;
- règles de rappel/relance simples.

### Sortie attendue

Ranti peut générer les échéances et préparer les rappels/relances.

### Risques

- Le mot "bail" peut être trop formel si le propriétaire a seulement un accord oral.
- Les règles de rappel peuvent être trop précoces dans l'onboarding.
- Un bail commencé en milieu de mois peut créer une première échéance ambiguë.

### Validation terrain

À vérifier : les propriétaires acceptent-ils de renseigner les règles de rappel dès la création du bail ?

---

## Flow 7 — Générer les échéances

### Situation observable

Un bail est actif.

### Hypothèse

Le propriétaire ne veut pas créer manuellement chaque mois de loyer.

### Action attendue

Ranti génère les échéances automatiquement à partir du bail.

### Données nécessaires

- bail actif ;
- montant ;
- date de début ;
- jour d'échéance ;
- période de facturation.

### Sortie attendue

Les échéances existent et peuvent être suivies.

### Risques

- Doublons d'échéances.
- Mauvais calcul en fin de mois.
- Changement de montant après génération.
- Bail terminé qui continue à générer des échéances.

### Validation terrain

À vérifier : les échéances générées correspondent-elles à la manière dont le propriétaire compte les mois ?

---

## Flow 8 — Préparer ou générer une relance

### Situation observable

Une échéance approche ou devient en retard.

### Hypothèse

Ranti peut réduire les oublis en préparant ou planifiant les rappels à partir du bail.

### Action attendue

Ranti crée une relance prévue, préparée ou envoyée selon la règle applicable.

### Données nécessaires

- échéance ;
- règle de rappel/relance ;
- statut de paiement ;
- canal ;
- message ;
- date prévue.

### Sortie attendue

Le propriétaire voit ce qui est prévu, envoyé, annulé ou échoué.

### Risques

- Relance envoyée alors que le paiement a été reçu hors Ranti.
- Message trop automatique ou trop agressif.
- Locataire sans numéro fiable.
- Doublon de relance.
- Canal externe non maîtrisé.

### Validation terrain

À vérifier : le propriétaire veut-il que Ranti envoie automatiquement ou préfère-t-il valider l'envoi ?

---

## Flow 9 — Valider un paiement reçu

### Situation observable

Le propriétaire reçoit un paiement en cash, Mobile Money, virement ou autre moyen.

### Hypothèse

Le propriétaire accepte de valider le paiement dans Ranti si l'action est rapide et produit une preuve utile.

### Action attendue

Il saisit ou confirme le montant, le locataire, le logement, la période et le moyen de paiement.

### Données nécessaires

- locataire ;
- logement ou bail ;
- échéance ;
- montant reçu ;
- moyen de paiement ;
- date de réception ;
- preuve facultative.

### Sortie attendue

L'échéance est mise à jour.

Si le paiement est partiel, Ranti génère un reçu partiel.

Si l'échéance est soldée, Ranti génère une quittance ou un reçu complet.

### Risques

- Paiement supérieur au solde.
- Paiement couvrant plusieurs mois.
- Paiement partiel mal compris.
- Double confirmation par erreur.
- Document généré alors que l'allocation est incorrecte.

### Validation terrain

À vérifier : le propriétaire comprend-il avant validation quel document sera généré ?

---

## Flow 10 — Retrouver l'historique

### Situation observable

Un propriétaire ou un locataire conteste ou vérifie un paiement passé.

### Hypothèse

L'historique doit réduire les conflits en reliant échéances, paiements, reçus/quittances et relances.

### Action attendue

Le propriétaire ouvre le locataire, le bail, l'échéance ou le document.

### Données nécessaires

- échéances ;
- réceptions ;
- allocations ;
- preuves ;
- reçus/quittances ;
- relances ;
- audit logs.

### Sortie attendue

Le propriétaire peut expliquer ce qui s'est passé sans dépendre de sa mémoire.

### Risques

- Trop d'informations affichées.
- Historique difficile à lire sur mobile.
- Document annulé ou remplacé mal présenté.

### Validation terrain

À vérifier : le propriétaire retrouve-t-il un paiement précis en moins d'une minute ?

---

## Prochaine étape de validation

Créer et alimenter `docs/research-log.md` avec :

- entretiens propriétaires ;
- observations terrain ;
- tests de maquette ;
- objections ;
- décisions prises après terrain.

Un flow non validé reste une hypothèse.
