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
3. quelle preuve existe pour chaque paiement ou encaissement ;
4. si une quittance simple peut être générée.

Le modèle de domaine indique que Ranti protège la mémoire fiable des loyers, plus précisément la mémoire des obligations de loyer et des paiements associés.

Le risque principal est de construire le produit autour du mauvais objet : propriété, locataire, paiement isolé, reçu ou tableau de bord.

Ces objets sont importants, mais aucun ne représente à lui seul l'obligation mensuelle que le propriétaire veut suivre.

## Décision

L'objet central de Ranti est l'échéance de loyer.

Une échéance de loyer représente une obligation de paiement attendue pour une période donnée.

Exemple : un locataire doit payer 50 000 FCFA pour le loyer de juillet 2026 avant le 5 juillet 2026.

Cette obligation existe même si aucun encaissement n'a encore été enregistré.

## Chaîne de domaine acceptée

Le modèle technique doit respecter cette chaîne :

Propriétaire → Propriété → Logement → Bail → Échéance de loyer → Encaissement → Preuve → Quittance → Relance

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

### Échéance de loyer

Une échéance appartient à un bail.

Elle représente ce qui est attendu pour une période donnée.

Elle peut être :

- à venir ;
- due ;
- partiellement réglée ;
- réglée ;
- en retard ;
- annulée ou corrigée si nécessaire.

Les statuts exacts seront définis dans le document de base de données.

### Encaissement

Un encaissement représente ce que le propriétaire déclare avoir reçu.

Il peut venir d'un paiement fait hors Ranti : cash, Mobile Money, virement ou autre moyen local.

Un encaissement peut régler une ou plusieurs échéances.

Une échéance peut recevoir plusieurs encaissements.

### Preuve

Une preuve justifie un paiement ou un encaissement.

Elle doit être reliée à un encaissement.

Une preuve ne doit pas exister comme simple fichier sans contexte métier.

### Validation humaine

Ranti ne confirme jamais seul qu'un paiement a été reçu.

Dans le MVP, le propriétaire valide qu'un encaissement a réellement été reçu.

### Quittance ou reçu

Une quittance ou un reçu est généré après validation d'un encaissement par le propriétaire.

La quittance confirme qu'une ou plusieurs échéances sont réglées.

Aucune quittance ne doit être générée pour un encaissement non validé.

### Relance

Une relance concerne une échéance non réglée ou en retard.

Dans le MVP, la relance doit rester simple et compréhensible.

L'automatisation avancée de relance n'est pas prioritaire tant que la preuve, l'encaissement et la validation humaine ne sont pas solides.

## Alternatives rejetées

### 1. Architecture centrée sur la propriété

Rejetée.

La propriété est importante, mais elle ne dit pas directement qui doit payer, pour quel mois, combien, ni quelle preuve existe.

### 2. Architecture centrée sur le locataire

Rejetée.

Le locataire est important dans la relation locative, mais il n'est pas le client commercial principal du MVP.

Une architecture centrée sur le locataire risquerait de transformer Ranti en portail locataire avant d'avoir résolu le problème du propriétaire.

### 3. Architecture centrée sur le paiement

Rejetée.

Un paiement ou encaissement est un événement. Il ne représente pas l'obligation attendue.

Si le système commence par les paiements, il peut perdre de vue les mois impayés, les paiements partiels et les échéances sans encaissement.

### 4. Architecture centrée sur le reçu

Rejetée.

Le reçu est une conséquence de la validation, pas le coeur du suivi.

Ranti doit d'abord savoir ce qui est dû, ce qui est encaissé et ce qui est prouvé.

## Conséquences techniques

La base de données devra rendre l'échéance explicite.

Les API devront exposer les actions métier autour de l'échéance : récupérer les échéances, enregistrer un encaissement, relier une preuve, valider, générer une quittance, relancer.

Les écrans devront aider le propriétaire à comprendre rapidement l'état des échéances : payé, non payé, en retard, preuve disponible.

Le système devra préserver l'historique des actions sensibles.

## Invariants

Ces règles ne doivent pas être violées par le code :

1. Une échéance de loyer appartient toujours à un bail.
2. Un bail relie un propriétaire, un logement et un locataire.
3. Un encaissement est enregistré du point de vue du propriétaire.
4. Un encaissement peut couvrir une ou plusieurs échéances.
5. Une échéance peut être couverte par plusieurs encaissements.
6. Une preuve appartient à un encaissement.
7. Une quittance ne peut être générée qu'après validation propriétaire.
8. Une relance doit être liée à une échéance non réglée ou en retard.
9. Une action sensible doit être traçable.
10. Aucune fonctionnalité ne doit rendre l'échéance secondaire.

## Ce que cette ADR ne décide pas encore

Cette ADR ne définit pas encore :

- les noms exacts des tables ;
- les statuts définitifs ;
- les endpoints API ;
- le fournisseur d'authentification ;
- le fournisseur de stockage ;
- le mécanisme exact de génération des échéances ;
- les règles détaillées de paiement partiel ou multi-mois.

Ces sujets seront traités dans des ADR et documents séparés.

## Prochaine étape

Rédiger `docs/database.md` à partir de cette décision.
