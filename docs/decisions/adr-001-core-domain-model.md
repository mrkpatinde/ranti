# ADR-001 — L'échéance de loyer est l'objet central du système

## Statut

Accepté.

## Date

2026-06-25

## Contexte

Ranti est le cahier de loyers moderne des propriétaires africains.

Le MVP doit aider un propriétaire à savoir clairement :

1. qui a payé ;
2. qui est en retard ;
3. quelle preuve existe pour chaque loyer reçu, si une preuve existe ;
4. si une quittance simple peut être générée.

Le modèle de domaine indique que Ranti protège la mémoire fiable des loyers, plus précisément la mémoire des obligations de loyer et des paiements associés.

Le risque principal est de construire le produit autour du mauvais objet : propriété, locataire, paiement isolé, reçu ou tableau de bord.

Ces objets sont importants, mais aucun ne représente à lui seul l'obligation mensuelle que le propriétaire veut suivre.

## Décision

L'objet central de Ranti est l'échéance de loyer.

Une échéance de loyer représente une obligation de paiement attendue pour une période donnée.

Exemple : un locataire doit payer 50 000 FCFA pour le loyer de juillet 2026 avant le 5 juillet 2026.

Cette obligation existe même si aucun loyer n'a encore été reçu.

## Chaîne de domaine acceptée

Le modèle technique doit respecter cette chaîne :

Propriétaire → Propriété → Logement → Bail → Échéance de loyer → Réception de loyer → Preuve éventuelle → Quittance → Relance

## Règles métier obligatoires

### Bail

Le bail ou accord locatif définit les règles qui permettent de créer les échéances :

- propriétaire ;
- logement ;
- locataire ;
- montant ;
- périodicité ;
- date d'échéance ;
- date de début ;
- date de fin éventuelle.

Un logement ne peut pas avoir deux baux actifs au même moment.

### Échéance de loyer

Une échéance appartient à un bail.

Elle représente ce qui est attendu pour une période donnée.

Les statuts principaux visibles dans le MVP restent simples : attendue, en retard, payée, annulée.

Le paiement partiel ou multi-mois doit être représenté par les montants et les allocations, pas nécessairement par un statut principal visible.

Les statuts techniques exacts seront définis dans le document de base de données.

### Réception de loyer

Une réception de loyer représente ce que le propriétaire confirme avoir reçu.

Elle peut correspondre à un paiement fait hors Ranti : cash, Mobile Money, virement ou autre moyen local.

Une réception de loyer peut régler une ou plusieurs échéances.

Une échéance peut être réglée par plusieurs réceptions de loyer.

### Allocation

Une allocation relie une réception de loyer à une échéance précise.

Elle indique quelle part du montant reçu sert à régler quelle échéance.

Elle permet de représenter proprement :

- un paiement partiel ;
- un paiement couvrant plusieurs mois ;
- plusieurs paiements pour une même échéance.

### Preuve

Une preuve peut justifier une réception de loyer.

Elle est utile, mais elle n'est pas obligatoire dans le MVP.

Lorsqu'elle existe, elle doit être reliée à une réception de loyer ou à un contexte métier clair.

Une preuve ne doit pas exister comme simple fichier sans contexte métier.

### Validation humaine

Ranti ne confirme jamais seul qu'un paiement a été reçu.

Dans le MVP, le propriétaire confirme la réception du loyer.

### Quittance ou reçu

Une quittance ou un reçu est généré après confirmation d'une réception de loyer par le propriétaire.

La quittance confirme qu'une ou plusieurs échéances sont réglées.

Aucune quittance ne doit être générée pour une réception non confirmée.

### Relance

Une relance concerne une échéance non réglée ou en retard.

Dans le MVP, la relance doit rester simple et compréhensible.

L'automatisation avancée de relance n'est pas prioritaire tant que la réception de loyer, la preuve éventuelle et la validation humaine ne sont pas solides.

## Alternatives rejetées

### 1. Architecture centrée sur la propriété

Rejetée.

La propriété est importante, mais elle ne dit pas directement qui doit payer, pour quel mois, combien, ni quelle preuve existe.

### 2. Architecture centrée sur le locataire

Rejetée.

Le locataire est important dans la relation locative, mais il n'est pas le client commercial principal du MVP.

Une architecture centrée sur le locataire risquerait de transformer Ranti en portail locataire avant d'avoir résolu le problème du propriétaire.

### 3. Architecture centrée sur le paiement ou la réception de loyer

Rejetée.

Un paiement ou une réception de loyer est un événement. Il ne représente pas l'obligation attendue.

Si le système commence par les paiements reçus, il peut perdre de vue les mois impayés, les paiements partiels et les échéances sans réception.

### 4. Architecture centrée sur le reçu

Rejetée.

Le reçu est une conséquence de la confirmation, pas le coeur du suivi.

Ranti doit d'abord savoir ce qui est dû, ce qui est reçu, ce qui est éventuellement prouvé et ce qui reste en retard.

## Conséquences techniques

La base de données devra rendre l'échéance explicite.

Les API devront exposer les actions métier autour de l'échéance : récupérer les échéances, enregistrer une réception de loyer, allouer les montants, attacher une preuve facultative, confirmer la réception, générer une quittance, relancer.

Les écrans devront aider le propriétaire à comprendre rapidement l'état des échéances : attendue, payée, en retard ou annulée.

Le système devra préserver l'historique des actions sensibles.

## Invariants

Ces règles ne doivent pas être violées par le code :

1. Une échéance de loyer appartient toujours à un bail.
2. Un bail relie un propriétaire, un logement et un locataire.
3. Un logement ne peut pas avoir deux baux actifs au même moment.
4. Une réception de loyer est confirmée du point de vue du propriétaire.
5. Une réception de loyer peut couvrir une ou plusieurs échéances.
6. Une échéance peut être couverte par plusieurs réceptions de loyer.
7. Une allocation relie une réception de loyer à une échéance.
8. Une preuve est facultative dans le MVP.
9. Une preuve, lorsqu'elle existe, doit être reliée à un contexte métier clair.
10. Une quittance ne peut être générée qu'après confirmation propriétaire.
11. Une relance doit être liée à une échéance non réglée ou en retard.
12. Une action sensible doit être traçable.
13. Aucune fonctionnalité ne doit rendre l'échéance secondaire.

## Ce que cette ADR ne décide pas encore

Cette ADR ne définit pas encore :

- les noms exacts des tables ;
- les statuts techniques définitifs ;
- les endpoints API ;
- le fournisseur d'authentification ;
- le fournisseur de stockage ;
- le mécanisme exact de génération des échéances ;
- les règles détaillées de correction ou d'annulation après quittance.

Ces sujets seront traités dans des ADR et documents séparés.

## Prochaine étape

Rédiger `docs/database.md` à partir de cette décision, puis ajuster `docs/api.md` après validation de la structure de données.
