# Ranti — Modèle de Domaine

## Statut

Version 0.4 — document de travail.

Ce document définit les concepts métier centraux de Ranti avant toute conception d'écran, de base de données ou d'API.

## Question fondatrice

Que protège Ranti ?

Ranti protège la mémoire fiable des loyers.

Plus précisément, Ranti protège la mémoire des obligations de loyer, des paiements associés, des relances nécessaires et des preuves générées.

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
5. si un reçu ou une quittance a été généré ;
6. si une relance est nécessaire ou déjà prévue.

### Définition métier

Une échéance de loyer représente une obligation de paiement attendue pour une période donnée.

Exemple :

Un locataire doit payer 50 000 FCFA pour le loyer de juillet 2026 avant le 5 juillet 2026.

Cette obligation existe même si le paiement n'a pas encore été effectué.

### Concepts reliés

Une échéance de loyer est reliée à :

- un propriétaire, qui attend le paiement ;
- un logement, qui est concerné par le loyer ;
- un locataire, qui doit payer ;
- un bail ou accord locatif, qui définit le montant et la périodicité ;
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

## Décision de domaine 003 — La relation locative est le contexte central

### Statut

Approuvé comme principe de domaine.

### Décision

Ranti ne protège pas seulement le propriétaire ou le locataire.

Ranti protège la relation locative entre eux.

Cette relation est matérialisée par un bail ou accord locatif pour un logement donné.

### Pourquoi

Quand la relation locative est claire, chaque partie est tranquille :

- le propriétaire sait ce qui est dû, payé ou en retard ;
- le locataire peut prouver ce qu'il a payé ;
- les obligations sont tracées ;
- les paiements sont reliés aux bonnes périodes ;
- les reçus et quittances peuvent être générés proprement ;
- les relances sont contextualisées ;
- les conflits diminuent.

### Conséquence métier

Le propriétaire est le client commercial principal de Ranti.

Mais dans le modèle de domaine, l'objet à sécuriser est la relation locative.

Sans relation locative, il n'y a pas d'échéance, pas de paiement de loyer, pas de preuve utile, pas de quittance et pas de relance contextualisée.

## Décision de domaine 004 — Les rappels et relances naissent du bail et des échéances

### Statut

Approuvé.

### Décision

Le propriétaire ne doit pas être le seul moteur de la relance.

À partir du bail, Ranti connaît la date d'échéance, le montant attendu, le locataire concerné et le canal de contact. À partir de l'échéance, Ranti peut préparer, planifier ou envoyer les rappels et relances selon les règles définies.

### Conséquence métier

La relance n'est pas une note libre isolée. Elle est toujours liée à une échéance de loyer.

Une relance ne modifie jamais le statut de paiement. Elle documente une action de suivi.

## Décision de domaine 005 — Les paiements validés génèrent automatiquement les preuves

### Statut

Approuvé.

### Décision

Après validation d'une réception de paiement par le propriétaire, Ranti génère automatiquement le document adapté.

- Paiement partiel validé : reçu de paiement partiel.
- Échéance totalement soldée : quittance ou reçu complet pour la période.

### Conséquence métier

Le propriétaire ne fabrique pas manuellement les preuves après chaque paiement.

Ranti transforme les paiements validés en preuves propres, numérotées, historisées et non modifiables silencieusement.

## Décision de domaine 006 — Le compte courant locatif (grand livre) devient l'objet central

### Statut

Approuvé (ADR-023, 2026-07-16). Transition en cours (phase Expand : le grand
livre est tenu en miroir, les décisions 001 à 005 restent la mécanique
opérante jusqu'à la bascule des lectures).

### Décision

Toute somme due ou reçue sur un bail est une **ligne de transaction** d'un
même grand livre : loyers (générés par le bail — la décision 002 devient la
règle de naissance des débits `loyer`), règlements, contre-passations. Les
**charges variables** sont **retirées** (ADR-026, Ranti rent-only) : seul le
loyer est désormais modélisé.

Chaque ligne porte un statut de reconnaissance : `pending` (affirmé par une
partie), `validated` (certain — indélébile), `disputed` (désaccord
documenté), `withdrawn` (retiré par son auteur avant validation).

Principe directeur de la validation : **une affirmation faite dans son propre
intérêt ne devient jamais certaine seule** (matrice complète dans l'ADR-023).

### Pourquoi

Le terrain montre que le problème central n'est pas le reçu mais les impayés
et l'absence de source de vérité partagée entre propriétaire et locataire. L'échéance (décision 001) reste le
cœur de la mécanique — elle devient un débit daté du grand livre ; le reçu
(décision 005) reste la preuve — il devient une sortie du grand livre.

### Conséquence métier

Le propriétaire lit trois nombres par bail, jamais fusionnés : le solde
certain (reconnu par les deux parties ou par le rail de paiement), l'en
attente (affirmé, pas reconnu), l'en litige (désaccord documenté). L'impayé
se calcule sur les seules lignes certaines exigibles.

## Concepts candidats du MVP

Les concepts suivants sont candidats pour le MVP :

- Propriétaire
- Propriété
- Logement
- Locataire
- Bail ou accord locatif
- Règle de rappel ou relance
- Échéance de loyer
- Transaction du grand livre (ADR-023)
- Paiement
- Preuve de paiement
- Quittance ou reçu
- Relance
- Historique d'audit

Ces concepts ne sont pas encore tous validés comme objets techniques ou tables de base de données.

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
8. Quand un reçu ou une quittance est-il donné ?
9. Le propriétaire accepte-t-il que Ranti prépare ou envoie les relances automatiquement ?
10. Quel est le moment exact où la confusion apparaît ?
