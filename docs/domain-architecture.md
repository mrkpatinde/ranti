# Ranti — Domain Architecture

## Statut

Version 1.0 — base de travail technique.

Ce document transforme le modèle de domaine de Ranti en architecture technique.

Il définit les modules du coeur applicatif, leurs responsabilités, leurs dépendances autorisées et les règles qui empêchent la dette technique.

Il ne définit pas encore le schéma final de base de données, les routes API détaillées ou les composants d'interface.

## Objectif

L'architecture de domaine doit permettre à Ranti de protéger la mémoire fiable des loyers.

Le système doit rester capable de répondre simplement à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque paiement ?

Toute organisation technique doit servir ces trois réponses.

## Principe central

Le coeur de Ranti n'est pas le dashboard.

Le coeur de Ranti n'est pas le paiement en ligne.

Le coeur de Ranti n'est pas WhatsApp.

Le coeur de Ranti est la relation entre :

- un propriétaire ;
- un logement ;
- un locataire ;
- un bail ;
- des échéances de loyer ;
- des encaissements ;
- des preuves ;
- des reçus ;
- des relances.

L'architecture doit rendre cette chaîne explicite.

## Style architectural

Ranti doit commencer comme un monolithe modulaire.

Cela signifie :

- une seule application principale ;
- un seul coeur métier cohérent ;
- des modules clairement séparés ;
- des dépendances contrôlées ;
- pas de microservices prématurés ;
- pas de duplication de règles métier dans plusieurs endroits.

Les modules sont des frontières de responsabilité dans le code.

Ils ne sont pas des services séparés au MVP.

## Couches recommandées

Ranti doit être organisé en couches simples.

```txt
Interface utilisateur
        |
        v
Application / Use Cases
        |
        v
Domain Core
        |
        v
Persistence / Adapters
        |
        v
Database / External Systems
```

### Interface utilisateur

L'interface permet au propriétaire d'agir simplement.

Elle affiche les informations, déclenche les actions et guide l'utilisateur.

Elle ne doit pas contenir seule les règles métier critiques.

### Application / Use Cases

Cette couche orchestre les actions métier.

Exemples :

- créer une propriété ;
- créer un logement ;
- créer un bail ;
- générer une échéance ;
- enregistrer un encaissement ;
- ajouter une preuve ;
- générer un reçu ;
- envoyer une relance.

Elle vérifie les permissions, appelle le domaine, déclenche les adaptateurs nécessaires et trace les actions importantes.

### Domain Core

Cette couche contient les concepts et règles métier de Ranti.

Elle doit rester indépendante de l'interface, de la base de données et des prestataires externes.

Elle contient les règles comme :

- une échéance naît d'un bail ;
- une échéance peut être partiellement encaissée ;
- un reçu ne peut pas être généré sans encaissement confirmé ;
- une relance doit être reliée à une échéance ;
- un encaissement peut couvrir une ou plusieurs échéances ;
- une échéance peut recevoir plusieurs encaissements ;
- les actions sensibles doivent être traçables.

### Persistence / Adapters

Cette couche permet au coeur de Ranti de communiquer avec le monde extérieur.

Elle contient :

- les repositories de base de données ;
- les adaptateurs de stockage fichiers ;
- les adaptateurs WhatsApp ;
- les adaptateurs SMS ;
- les adaptateurs email ;
- les adaptateurs de paiement ;
- les adaptateurs PDF ;
- les outils d'observabilité.

Les adaptateurs ne doivent pas décider des règles métier.

Ils exécutent une demande validée par le coeur ou par un use case.

## Modules du domaine

### `auth`

Responsabilité : identifier les utilisateurs et protéger les sessions.

Ce module gère :

- connexion ;
- inscription ;
- session ;
- identité utilisateur ;
- récupération d'accès si nécessaire.

Ce module ne décide pas ce qu'un propriétaire peut faire dans ses données métier.

Il fournit une identité fiable aux autres modules.

### `landlords`

Responsabilité : représenter le propriétaire dans Ranti.

Ce module gère :

- profil propriétaire ;
- espace propriétaire ;
- informations de contact ;
- préférences simples ;
- périmètre de données.

Le propriétaire est le client commercial principal du MVP.

Toutes les données métier doivent être rattachées à un propriétaire ou à son espace.

### `properties`

Responsabilité : représenter les propriétés du propriétaire.

Ce module gère :

- création de propriété ;
- nom ou description simple ;
- localisation approximative si nécessaire ;
- rattachement au propriétaire.

Une propriété est un lieu physique.

Elle peut contenir plusieurs logements.

### `units`

Responsabilité : représenter les espaces louables.

Ce module gère :

- logement ;
- type de logement ;
- statut simple ;
- appartenance à une propriété.

Le logement est ce qui est effectivement loué.

Une échéance de loyer doit toujours pouvoir être reliée à un logement.

### `tenants`

Responsabilité : représenter les locataires.

Ce module gère :

- identité simple du locataire ;
- numéro de téléphone ;
- informations utiles au suivi ;
- rattachement à une relation locative.

Dans le MVP, le locataire ne pilote pas le produit.

Il peut recevoir une relance, transmettre une preuve ou recevoir un reçu.

### `leases`

Responsabilité : représenter le bail ou accord locatif.

Ce module gère :

- propriétaire concerné ;
- logement concerné ;
- locataire concerné ;
- montant du loyer ;
- périodicité ;
- jour d'échéance ;
- date de début ;
- date de fin si elle existe ;
- statut du bail.

Le bail est la source des règles de génération des échéances.

Il ne doit pas être confondu avec le contrat.

Le contrat est un document.

Le bail est la règle métier.

### `rent_dues`

Responsabilité : représenter les échéances de loyer.

C'est le module central du MVP.

Il gère :

- période de loyer ;
- montant attendu ;
- date limite ;
- montant encaissé ;
- reste dû ;
- statut de l'échéance ;
- relation avec le bail ;
- relation avec les encaissements ;
- besoin de relance.

Ce module doit permettre de répondre rapidement :

- qui devait payer ;
- combien devait être payé ;
- qui a payé ;
- qui est en retard ;
- combien reste dû ;
- quelle preuve existe ;
- si un reçu peut être généré.

### `collections`

Responsabilité : représenter les encaissements du point de vue du propriétaire.

Ce module gère :

- montant encaissé ;
- date d'encaissement ;
- méthode d'encaissement ;
- statut de confirmation ;
- rattachement à une ou plusieurs échéances ;
- rattachement à une preuve si elle existe ;
- annulation ou correction avec trace.

Le terme `collection` est utilisé techniquement pour traduire l'encaissement.

Le module ne doit pas être dépendant d'un prestataire de paiement.

Un encaissement peut venir du cash, du Mobile Money, d'un virement ou d'une déclaration manuelle.

### `payment_proofs`

Responsabilité : conserver les preuves de paiement.

Ce module gère :

- type de preuve ;
- fichier ou référence ;
- auteur de l'ajout ;
- date d'ajout ;
- lien avec un encaissement ou une échéance ;
- accès sécurisé.

Une preuve peut être une capture Mobile Money, une photo de reçu papier, un reçu bancaire ou un autre document utile.

Les preuves sont sensibles et ne doivent pas être publiques sans contrôle.

### `receipts`

Responsabilité : générer et conserver les quittances ou reçus.

Ce module gère :

- numéro de reçu ;
- données utilisées pour générer le document ;
- échéance ou échéances couvertes ;
- encaissement ou encaissements associés ;
- date de génération ;
- statut ;
- lien de partage contrôlé si nécessaire.

Un reçu doit être déterministe.

Il doit être généré à partir de données confirmées.

Il ne doit pas être modifié silencieusement après génération.

### `reminders`

Responsabilité : représenter les relances.

Ce module gère :

- échéance concernée ;
- locataire concerné ;
- canal utilisé ;
- contenu envoyé ou modèle utilisé ;
- date d'envoi ;
- statut d'envoi ;
- historique.

La relance peut passer par WhatsApp, SMS ou un autre canal.

Mais la relance doit exister dans Ranti avant ou pendant l'envoi.

Le canal ne doit pas devenir la source de vérité.

### `notifications`

Responsabilité : gérer les communications techniques avec les canaux externes.

Ce module gère :

- envoi WhatsApp ;
- envoi SMS ;
- envoi email ;
- statut de livraison si disponible ;
- erreurs d'envoi ;
- retries simples.

Ce module ne décide pas qui doit être relancé.

Il envoie ce qu'un use case métier a demandé.

### `audit_logs`

Responsabilité : tracer les actions sensibles.

Ce module gère :

- acteur ;
- action ;
- objet concerné ;
- date ;
- ancienne valeur si nécessaire ;
- nouvelle valeur si nécessaire ;
- contexte technique minimal.

Les logs d'audit ne sont pas une fonctionnalité secondaire.

Ils protègent la confiance dans le système.

## Dépendances autorisées

Les dépendances doivent aller du plus haut niveau vers le coeur, puis vers les adaptateurs.

```txt
UI -> Use Cases -> Domain Core -> Ports
                         |
                         v
                    Domain Rules

Adapters -> Ports
Database -> Repositories
External Providers -> Adapters
```

Le domaine peut définir ce dont il a besoin.

Les adaptateurs implémentent ces besoins.

Le domaine ne doit pas connaître les détails de Supabase, WhatsApp, Mobile Money, PDF, email ou stockage fichiers.

## Dépendances interdites

Ranti interdit les dépendances suivantes :

- une règle métier critique uniquement dans un composant UI ;
- un module `rent_dues` dépendant directement d'un prestataire de paiement ;
- un module `receipts` qui génère un reçu sans vérifier l'état métier ;
- un module `reminders` qui relance sans échéance associée ;
- un module `collections` qui dépend uniquement d'un webhook externe ;
- un fichier de preuve accessible sans contrôle ;
- une modification d'encaissement sans audit log ;
- une suppression physique silencieuse d'une échéance, d'un encaissement, d'une preuve ou d'un reçu.

## Use cases prioritaires du MVP

Les premiers use cases techniques doivent suivre les parcours produit.

### 1. Créer un espace propriétaire

Entrée : identité utilisateur.

Sortie : espace propriétaire prêt.

Modules concernés : `auth`, `landlords`, `audit_logs`.

### 2. Créer une propriété

Entrée : informations simples de propriété.

Sortie : propriété rattachée au propriétaire.

Modules concernés : `landlords`, `properties`, `audit_logs`.

### 3. Créer un logement

Entrée : propriété, type ou nom de logement.

Sortie : logement disponible pour une relation locative.

Modules concernés : `properties`, `units`, `audit_logs`.

### 4. Ajouter un locataire

Entrée : nom, téléphone et informations utiles.

Sortie : locataire rattaché au propriétaire.

Modules concernés : `landlords`, `tenants`, `audit_logs`.

### 5. Créer un bail

Entrée : propriétaire, logement, locataire, montant, périodicité, date d'échéance, date de début.

Sortie : bail actif ou prêt à activer.

Modules concernés : `leases`, `units`, `tenants`, `audit_logs`.

### 6. Générer les échéances

Entrée : bail actif.

Sortie : une ou plusieurs échéances de loyer.

Modules concernés : `leases`, `rent_dues`, `audit_logs`.

### 7. Enregistrer un encaissement

Entrée : échéance, montant, méthode, date, preuve optionnelle.

Sortie : encaissement enregistré et échéance mise à jour.

Modules concernés : `rent_dues`, `collections`, `payment_proofs`, `audit_logs`.

### 8. Générer un reçu

Entrée : encaissement confirmé ou échéance réglée.

Sortie : reçu généré et conservé.

Modules concernés : `rent_dues`, `collections`, `receipts`, `audit_logs`.

### 9. Relancer un locataire

Entrée : échéance due ou en retard.

Sortie : relance enregistrée et éventuellement envoyée.

Modules concernés : `rent_dues`, `reminders`, `notifications`, `audit_logs`.

## Transitions métier importantes

### Échéance de loyer

Statuts candidats :

- `upcoming` : l'échéance existe mais n'est pas encore due ;
- `due` : l'échéance est attendue ;
- `partially_collected` : une partie a été encaissée ;
- `collected` : le montant attendu est encaissé ;
- `overdue` : la date limite est dépassée et le montant n'est pas réglé ;
- `cancelled` : l'échéance a été annulée avec trace ;
- `disputed` : l'échéance fait l'objet d'une contestation.

Ces statuts restent candidats jusqu'au document de base de données.

### Encaissement

Statuts candidats :

- `draft` : encaissement commencé mais pas validé ;
- `pending_confirmation` : encaissement en attente de confirmation ;
- `confirmed` : propriétaire confirme avoir reçu le montant ;
- `cancelled` : encaissement annulé avec trace ;
- `reversed` : encaissement corrigé ou inversé avec trace.

Ces statuts doivent rester compréhensibles par le propriétaire, même si les noms techniques sont en anglais.

## Règles métier initiales

### Règle 1 — Une échéance vient d'un bail

Une échéance de loyer doit normalement être générée à partir d'un bail actif.

Les échéances exceptionnelles devront être décidées plus tard.

### Règle 2 — Un encaissement doit être relié à une obligation

Un encaissement doit être relié à une ou plusieurs échéances.

Un encaissement isolé rend la mémoire des loyers confuse.

### Règle 3 — Une preuve ne suffit pas à confirmer un encaissement

Une preuve aide à documenter un paiement.

Mais dans le MVP, la confirmation reste humaine côté propriétaire.

### Règle 4 — Un reçu vient après confirmation

Un reçu ne doit pas être généré avant confirmation d'un encaissement.

### Règle 5 — Une relance doit être rattachée à une échéance

Une relance sans échéance devient un simple message.

Ranti doit relancer proprement sur la base d'une obligation claire.

### Règle 6 — Une correction doit laisser une trace

Toute correction sur une échéance, un encaissement, une preuve ou un reçu doit être visible dans l'audit log.

## Événements de domaine candidats

Les événements suivants pourront être utiles pour structurer le système :

- `landlord.created`
- `property.created`
- `unit.created`
- `tenant.created`
- `lease.created`
- `lease.activated`
- `rent_due.generated`
- `rent_due.marked_overdue`
- `collection.created`
- `collection.confirmed`
- `collection.cancelled`
- `payment_proof.added`
- `receipt.generated`
- `reminder.created`
- `reminder.sent`

Ces événements ne signifient pas qu'il faut créer une architecture événementielle complexe au MVP.

Ils servent d'abord à nommer clairement ce qui se passe.

## Ordre de construction recommandé

L'ordre de construction doit respecter la logique métier.

1. `auth`
2. `landlords`
3. `properties`
4. `units`
5. `tenants`
6. `leases`
7. `rent_dues`
8. `collections`
9. `payment_proofs`
10. `receipts`
11. `reminders`
12. `notifications`
13. `audit_logs`

Cependant, `audit_logs` doit être pensé dès le début.

Il peut être implémenté progressivement, mais les actions critiques ne doivent pas rester sans trace.

## Décisions à reporter

Les sujets suivants ne doivent pas bloquer ce document :

- choix final du framework ;
- choix final du service d'authentification ;
- choix final du prestataire WhatsApp ;
- choix final du prestataire SMS ;
- choix final du prestataire de paiement ;
- stratégie PDF détaillée ;
- stratégie multi-pays avancée ;
- espace locataire complet ;
- rôle gestionnaire avancé ;
- analytics avancés.

Ces décisions viendront après la stabilisation du coeur de domaine.

## Règle de contrôle

Avant de créer un module, une table, un service ou une API, il faut vérifier qu'il appartient à l'une de ces catégories :

1. il représente un concept du domaine ;
2. il exécute un use case nécessaire ;
3. il protège la sécurité ou l'intégrité ;
4. il connecte proprement un prestataire externe ;
5. il améliore la maintenabilité sans masquer le métier.

Si ce n'est pas le cas, il ne doit pas entrer dans l'architecture du MVP.

## Phrase de contrôle

Le code de Ranti doit raconter la même histoire que le propriétaire raconte dans son cahier :

> Voici mon logement. Voici mon locataire. Voici le loyer attendu. Voici ce qui a été encaissé. Voici la preuve. Voici le reçu. Voici la relance si nécessaire.

Si le code ne raconte plus cette histoire, l'architecture dérive.
