# Ranti — Modèle de Domaine

## Statut

Version 0.2 — document de travail.

Ce document définit les concepts métier centraux de Ranti avant toute conception d'écran, de base de données ou d'API.

## Question fondatrice

Que protège Ranti ?

Ranti protège la mémoire fiable des loyers.

Plus précisément, Ranti protège la mémoire des obligations de loyer et des paiements associés.

## Décision de domaine 001 — L'échéance de loyer est l'objet central du MVP

### Statut

Hypothèse forte à valider terrain.

### Décision

Dans le MVP, l'objet central de Ranti est l'échéance de loyer.

Ce n'est pas le bien, le locataire, le paiement ou le reçu qui pilotent le modèle.

Le coeur du produit est une obligation de paiement mensuelle qui doit être suivie jusqu'à son règlement.

### Pourquoi

Le propriétaire n'a pas seulement besoin de lister des biens ou des locataires.

Il veut savoir, pour chaque période de loyer :

1. qui devait payer ;
2. combien devait être payé ;
3. si le paiement a été reçu ;
4. quelle preuve existe ;
5. si un reçu peut être généré ;
6. si une relance est nécessaire.

### Définition métier

Une échéance de loyer représente une obligation de paiement attendue pour une période donnée.

Exemple :

Un locataire doit payer 50 000 FCFA pour le loyer de juillet 2026 avant le 5 juillet 2026.

Cette obligation existe même si le paiement n'a pas encore été effectué.

### Concepts reliés

Une échéance de loyer est reliée à :

- un propriétaire, qui attend le paiement ;
- un logement ou une unité, qui est concerné par le loyer ;
- un locataire, qui doit payer ;
- un bail ou accord de location, qui définit le montant et la périodicité ;
- un paiement, qui peut couvrir totalement ou partiellement l'échéance ;
- une preuve de paiement, qui justifie le paiement ;
- une quittance ou reçu, qui confirme que le paiement a été accepté ;
- une relance, si l'échéance n'est pas réglée.

## Décision de domaine 002 — Les échéances naissent automatiquement à partir du bail

### Statut

Hypothèse forte à valider terrain.

### Décision

Dans le MVP, une échéance de loyer naît automatiquement à partir d'un bail ou d'un accord locatif.

Le propriétaire ne doit pas créer manuellement chaque échéance mensuelle.

### Pourquoi

Le propriétaire ne pense généralement pas :

> Je dois créer le loyer du mois prochain.

Il pense plutôt :

> Ce locataire paie chaque mois.

Ranti doit traduire cette réalité métier en échéances suivables.

### Exemple

Si un bail indique :

- locataire : Aline ;
- loyer mensuel : 50 000 FCFA ;
- paiement attendu le 5 de chaque mois ;
- début du bail : 1er janvier 2026.

Alors Ranti doit pouvoir générer les échéances mensuelles correspondantes.

### Conséquences produit

- Le bail devient la source des règles de génération des échéances.
- Le propriétaire configure une règle une fois, au lieu de répéter la même action chaque mois.
- Le produit réduit le risque d'oubli.
- Le système doit gérer les cas où le bail change, se termine ou est suspendu.

### Questions ouvertes

- Faut-il générer toutes les échéances à l'avance ou seulement les prochaines échéances ?
- Que se passe-t-il si le propriétaire modifie le montant du loyer ?
- Que se passe-t-il si le locataire quitte le logement ?
- Que se passe-t-il si le propriétaire veut créer une échéance exceptionnelle ?

## Concepts candidats du MVP

Les concepts suivants sont candidats pour le MVP :

- Propriétaire
- Bien
- Unité
- Locataire
- Bail
- Échéance de loyer
- Paiement
- Preuve de paiement
- Quittance ou reçu
- Relance

Ces concepts ne sont pas encore validés comme objets techniques ou tables de base de données.

Ils sont d'abord des concepts métier.

## Règle importante

Nous ne dessinons pas encore la base de données.

Nous ne définissons pas encore les écrans.

Nous cherchons d'abord à comprendre les règles du métier.

## Questions terrain à valider

1. Les propriétaires pensent-ils naturellement en termes de mois de loyer à payer ?
2. Suivent-ils les paiements par locataire, par logement, par mois ou par reçu ?
3. Comment définissent-ils qu'un mois est soldé ?
4. Que se passe-t-il quand un locataire paie partiellement ?
5. Que se passe-t-il quand un paiement arrive en retard ?
6. Que se passe-t-il quand un paiement couvre plusieurs mois ?
7. Quelles preuves sont considérées comme suffisantes ?
8. Quand un reçu est-il donné ?
9. Qui initie la relance : le propriétaire, un gestionnaire, ou personne ?
10. Quel est le moment exact où la confusion apparaît ?
