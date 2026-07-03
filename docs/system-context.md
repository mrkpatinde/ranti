# Ranti — System Context

## Statut

Version 1.0 — base de travail technique.

Ce document définit le contexte système de Ranti : les utilisateurs, les systèmes externes, les frontières du produit et les responsabilités du coeur applicatif.

Il ne définit pas encore la base de données, les API, les écrans ou le choix final des prestataires.

## Objectif

Ranti est le registre de loyer moderne des propriétaires africains.

Le système doit aider un propriétaire à répondre rapidement à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque paiement ?

Le contexte système doit protéger cette promesse en évitant que Ranti devienne trop large, trop complexe ou dépendant d'un prestataire externe.

## Vue d'ensemble

Ranti est une application web mobile-first qui permet à un propriétaire de gérer ses relations locatives, ses échéances de loyer, ses encaissements, ses preuves, ses reçus et ses relances.

Le coeur de Ranti est le système qui conserve la mémoire fiable des loyers.

Les canaux externes comme WhatsApp, SMS, email, Mobile Money ou PDF ne sont pas le coeur de Ranti.

Ils servent à faciliter l'usage, mais la source de vérité reste dans Ranti.

## Acteurs humains

### Propriétaire

Le propriétaire est l'utilisateur principal du MVP.

Il possède ou gère entre 1 et 20 logements.

Il utilise Ranti pour :

- créer son espace ;
- enregistrer ses propriétés ;
- ajouter ses logements ;
- ajouter ses locataires ;
- créer les baux ou accords locatifs ;
- suivre les échéances ;
- confirmer les encaissements ;
- garder les preuves ;
- générer les reçus ;
- relancer les locataires en retard.

Le système doit être construit d'abord pour lui.

### Locataire

Le locataire est un acteur secondaire dans le MVP.

Il n'est pas le centre du produit, mais il peut interagir avec Ranti pour :

- recevoir une relance ;
- ouvrir un lien ;
- transmettre une preuve de paiement ;
- recevoir une quittance ou un reçu ;
- vérifier ce qui lui est demandé.

Le MVP ne doit pas obliger le locataire à créer un compte complet si ce n'est pas nécessaire.

### Petit gestionnaire local

Le petit gestionnaire local est un acteur observé, mais il ne pilote pas le MVP.

Il peut gérer plusieurs biens ou plusieurs propriétaires, mais ce besoin peut pousser le produit vers une complexité prématurée.

Pour le MVP, ses besoins doivent être notés, mais ne doivent pas déterminer l'architecture centrale.

### Administrateur Ranti

L'administrateur Ranti est un acteur interne.

Il peut avoir besoin de :

- consulter certains éléments techniques ;
- diagnostiquer un problème ;
- vérifier des logs ;
- aider un utilisateur ;
- gérer un incident de sécurité.

Les accès administrateur doivent être limités, tracés et justifiés.

Un administrateur ne doit pas devenir une solution de contournement aux règles métier.

## Systèmes externes

### WhatsApp

WhatsApp peut servir à envoyer des relances, partager des reçus, transmettre des liens ou recevoir des preuves.

WhatsApp n'est pas la base de données de Ranti.

Un message WhatsApp important doit être relié à un objet Ranti : échéance, encaissement, preuve, reçu ou relance.

### SMS

Le SMS peut servir de canal de secours lorsque WhatsApp n'est pas disponible ou pas adapté.

Le SMS est un canal de notification, pas un système de domaine.

### Email

L'email peut servir à envoyer des reçus, des notifications ou des messages administratifs.

L'email ne doit pas être obligatoire pour l'expérience MVP si les utilisateurs principaux fonctionnent d'abord par téléphone et WhatsApp.

### Prestataire de paiement

Un prestataire de paiement peut faciliter les paiements Mobile Money, carte ou virement.

Mais le prestataire de paiement ne doit pas contrôler le modèle de domaine.

Ranti doit pouvoir enregistrer un encaissement cash, Mobile Money, virement ou manuel même sans intégration de paiement en ligne.

### Stockage de fichiers

Le stockage de fichiers peut contenir des preuves de paiement, des contrats, des reçus générés ou d'autres documents utiles.

Ces fichiers doivent être protégés par des règles d'accès strictes.

Un fichier sensible ne doit jamais être publiquement accessible sans contrôle.

### Générateur de PDF

Le générateur de PDF peut produire des quittances ou reçus.

Il ne décide pas si une quittance peut être générée.

Cette décision appartient au coeur métier de Ranti.

### Service d'authentification

Le service d'authentification permet d'identifier les utilisateurs.

Le choix exact peut évoluer.

Ranti doit cependant garantir :

- une identité utilisateur claire ;
- une séparation stricte des données ;
- des sessions sécurisées ;
- une autorisation côté serveur.

### Observabilité et erreurs

Un service d'observabilité peut aider à suivre les erreurs, les performances et les incidents.

Il ne doit pas recevoir inutilement des données sensibles comme des preuves de paiement ou des informations privées de locataires.

## Frontière du système Ranti

### Dans le coeur de Ranti

Les responsabilités suivantes appartiennent au coeur du système :

- gérer les propriétaires ;
- gérer les propriétés ;
- gérer les logements ;
- gérer les locataires ;
- gérer les baux ;
- générer les échéances de loyer ;
- suivre le statut des échéances ;
- enregistrer les encaissements ;
- associer les preuves de paiement ;
- générer les quittances ou reçus ;
- enregistrer les relances ;
- appliquer les permissions ;
- conserver les logs d'audit ;
- protéger les données sensibles.

### Hors du coeur de Ranti

Les éléments suivants ne doivent pas devenir le coeur du système :

- WhatsApp ;
- Mobile Money ;
- prestataire de paiement ;
- générateur PDF ;
- outil d'analytics ;
- service email ;
- service SMS ;
- outil de support client ;
- tableau de bord avancé ;
- CRM immobilier ;
- marketplace immobilière ;
- logiciel comptable ;
- agence de recouvrement.

Ces éléments peuvent être intégrés plus tard, mais ils doivent rester périphériques.

## Diagramme de contexte textuel

```txt
[Propriétaire]
      |
      | utilise
      v
[Ranti Web App Mobile-First]
      |
      | appelle
      v
[Ranti Backend / Domain Core]
      |
      | lit / écrit
      v
[Ranti Database]
      |
      | protège
      v
[Propriétés, logements, baux, échéances, encaissements, preuves, reçus, relances, audit logs]

[Locataire]
      |
      | reçoit / transmet via lien ou canal externe
      v
[WhatsApp / SMS / Email]
      |
      | redirige vers ou reflète
      v
[Ranti]

[Ranti]
      | utilise comme adaptateurs
      v
[Prestataires de paiement] [Stockage fichiers] [Générateur PDF] [Observabilité]
```

## Flux système principaux

### Flux 1 — Création de l'espace propriétaire

1. Le propriétaire ouvre Ranti.
2. Il crée son espace.
3. Ranti crée son identité et son périmètre de données.
4. Toutes les données futures sont rattachées à ce périmètre.

Objectif système : garantir une séparation stricte entre les propriétaires.

### Flux 2 — Mise en place de la relation locative

1. Le propriétaire crée une propriété.
2. Il ajoute un ou plusieurs logements.
3. Il ajoute un locataire.
4. Il crée un bail ou accord locatif.
5. Ranti peut générer les échéances de loyer.

Objectif système : construire une relation locative claire avant de suivre les loyers.

### Flux 3 — Suivi d'une échéance

1. Une échéance existe pour une période donnée.
2. Le propriétaire voit si elle est à venir, due, partiellement encaissée, encaissée ou en retard.
3. Ranti affiche le montant attendu, le montant encaissé, le reste dû et les preuves associées.

Objectif système : répondre rapidement à la question “qui a payé et qui est en retard ?”.

### Flux 4 — Enregistrement d'un encaissement

1. Le propriétaire reçoit tout ou partie d'un loyer.
2. Il enregistre l'encaissement dans Ranti.
3. Il peut ajouter une preuve si nécessaire.
4. Ranti met à jour l'échéance concernée.
5. Ranti trace l'action.

Objectif système : garder une mémoire fiable de ce qui a été reçu.

### Flux 5 — Génération d'une quittance ou d'un reçu

1. Une échéance est réglée ou un encaissement est confirmé.
2. Le propriétaire demande une quittance ou un reçu.
3. Ranti vérifie les conditions métier.
4. Ranti génère un document à partir des données confirmées.
5. Le reçu peut être partagé au locataire.
6. L'action est tracée.

Objectif système : produire une preuve fiable, déterministe et non ambiguë.

### Flux 6 — Relance d'un locataire

1. Une échéance est due ou en retard.
2. Le propriétaire choisit de relancer.
3. Ranti enregistre la relance.
4. Ranti peut envoyer le message via WhatsApp, SMS ou un autre canal.
5. L'historique reste visible dans Ranti.

Objectif système : relancer proprement sans perdre la trace.

## Données sensibles

Ranti doit traiter comme sensibles :

- les identités des propriétaires ;
- les identités des locataires ;
- les numéros de téléphone ;
- les montants de loyer ;
- les retards ;
- les preuves de paiement ;
- les reçus ;
- les contrats ;
- les historiques d'encaissement ;
- les logs d'audit.

Ces données ne doivent pas être exposées à des tiers sans nécessité claire.

## Frontières de confiance

Ranti doit distinguer plusieurs zones de confiance :

### Zone utilisateur

Le navigateur mobile ou desktop appartient à l'utilisateur.

Il ne doit pas être considéré comme une source fiable pour appliquer les règles métier critiques.

### Zone serveur Ranti

Le serveur applique les règles métier, les permissions, la validation et les transitions d'état.

C'est la zone principale de confiance applicative.

### Zone base de données

La base de données conserve la source de vérité.

Elle doit protéger l'intégrité des données et empêcher les accès transversaux entre propriétaires.

### Zone prestataires externes

Les prestataires externes sont utiles, mais non souverains.

Leurs réponses doivent être validées, normalisées et rattachées aux objets du domaine avant d'être utilisées.

## Principes d'intégration

Chaque intégration externe doit respecter ces règles :

1. Elle doit être optionnelle ou remplaçable autant que possible.
2. Elle ne doit pas modifier directement le modèle de domaine.
3. Elle doit passer par un adaptateur clair.
4. Elle doit tracer les événements importants.
5. Elle ne doit pas recevoir plus de données que nécessaire.
6. Elle doit gérer les erreurs sans casser le coeur de Ranti.
7. Elle doit préserver la compréhension du propriétaire.

## Ce que Ranti refuse dans le MVP

Ranti refuse dans le MVP :

- la marketplace immobilière ;
- la gestion comptable complète ;
- les commissions de gestionnaire ;
- le recouvrement automatisé agressif ;
- le scoring de locataires ;
- les contrats juridiques complexes ;
- la gestion multi-agences ;
- les workflows d'entreprise ;
- les intégrations bancaires lourdes ;
- l'automatisation qui confirme un paiement sans contrôle humain ;
- les analytics avancés qui ne servent pas le suivi mensuel des loyers.

## Questions ouvertes

Les décisions suivantes restent à préciser dans des documents dédiés :

1. Le mode exact d'authentification du MVP.
2. Le niveau d'interaction locataire sans compte.
3. Le format final des statuts d'échéance.
4. Le format final des statuts d'encaissement.
5. La politique de stockage des preuves.
6. La politique d'expiration des liens publics.
7. Le niveau de support WhatsApp au MVP.
8. Le choix initial du prestataire de génération PDF.
9. La stratégie d'audit logs minimale.
10. Le périmètre exact du rôle administrateur.

Ces questions ne doivent pas bloquer la suite, mais elles doivent être résolues avant l'implémentation complète des modules concernés.

## Règle de contrôle

Ranti doit rester le système de mémoire fiable des loyers.

Chaque système externe doit servir cette mémoire, jamais la remplacer.

Si une intégration, un écran ou un module rend moins clair le fait de savoir qui a payé, qui est en retard ou quelle preuve existe, il doit être simplifié, reporté ou supprimé.
