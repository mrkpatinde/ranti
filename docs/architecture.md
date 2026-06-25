# Ranti — Architecture Technique

## Statut

Version 0.2 — base de travail initiale.

Ce document définit l'architecture technique de départ de Ranti.

Il ne remplace pas la Vision, les Personas, le Modèle de Domaine, le Glossaire, les User Journeys ou les Product Principles.

Il traduit ces documents en règles techniques simples.

## Rôle de ce document

Ce document vient avant `docs/api.md` et `docs/database.md`.

L'ordre de conception est :

1. Fondation Produit ;
2. Architecture Technique ;
3. Base de données ;
4. API ;
5. Implémentation.

Une API ou une table ne doit pas introduire une règle métier qui n'existe pas dans l'architecture ou dans le domaine.

## Objectif technique

Construire Ranti comme un système simple, robuste et compréhensible, capable de protéger la mémoire fiable des loyers sans devenir un CRM immobilier, une marketplace, une banque, un outil comptable complet ou une application de gestion complexe.

L'architecture doit aider le propriétaire à répondre rapidement à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque loyer reçu, si une preuve existe ?

## Décision d'architecture principale

Ranti doit être conçu comme un monolithe modulaire.

Cela signifie :

- une seule application produit au départ ;
- une seule base de données relationnelle ;
- des modules métier séparés dans le code ;
- des règles de domaine explicites ;
- aucune séparation artificielle en microservices ;
- aucune complexité d'infrastructure avant preuve d'usage terrain.

## Pourquoi un monolithe modulaire

Le MVP de Ranti doit rester petit, vérifiable et facile à faire évoluer.

Un monolithe modulaire permet de :

- livrer plus vite sans disperser la logique métier ;
- garder les transactions simples ;
- éviter une dette d'infrastructure inutile ;
- protéger la cohérence entre bail, échéance, réception de loyer, preuve et reçu ;
- permettre une future séparation si le produit prouve un besoin réel.

## Objet central du système

L'objet central du MVP est l'échéance de loyer.

Le système doit être organisé autour de cette chaîne métier :

Propriétaire → Propriété → Logement → Bail → Échéance de loyer → Réception de loyer → Preuve éventuelle → Quittance → Relance

Conséquences :

- une échéance existe même si aucun loyer n'a encore été reçu ;
- un bail est la source des règles qui créent les échéances ;
- une réception de loyer peut régler une ou plusieurs échéances ;
- une échéance peut être réglée par plusieurs réceptions de loyer ;
- une preuve peut justifier une réception de loyer, mais elle n'est pas obligatoire dans le MVP ;
- une quittance confirme une ou plusieurs échéances réglées ;
- une relance concerne une échéance non réglée ou en retard.

## Vocabulaire technique et vocabulaire utilisateur

Le domaine peut utiliser des termes précis comme `paiement`, `réception de loyer`, `allocation` ou `confirmation`.

L'interface propriétaire doit parler plus simplement :

- loyer reçu ;
- confirmer la réception ;
- reçu ;
- retard ;
- relance.

Le code ne doit pas forcer l'interface à utiliser un vocabulaire technique.

## Modules métier initiaux

### 1. Identité et accès

Responsabilité : gérer les comptes, les sessions, les permissions et l'isolation des données.

Le propriétaire est le client commercial principal.

Le locataire peut interagir avec Ranti plus tard, mais il ne pilote pas le MVP.

### 2. Contexte locatif

Responsabilité : gérer les concepts qui décrivent la relation locative.

Objets concernés : propriétaire, propriété, logement, locataire, bail ou accord locatif.

Le bail relie un propriétaire, un logement et un locataire.

Il définit le montant, la périodicité, la date d'échéance, la date de début et éventuellement la date de fin.

Règle non négociable : un logement ne peut avoir qu'un seul bail actif à un instant donné.

### 3. Moteur d'échéances

Responsabilité : créer, suivre et exposer les obligations de loyer attendues.

Le propriétaire ne doit pas créer manuellement chaque échéance mensuelle si le bail permet de les générer.

La génération automatique des échéances doit rester simple au départ : elle doit couvrir le cas mensuel standard avant les cas exceptionnels.

### 4. Réceptions de loyer

Responsabilité : enregistrer ce que le propriétaire confirme avoir reçu.

Une réception de loyer est enregistrée du point de vue du propriétaire.

Elle peut correspondre à un paiement fait hors Ranti : cash, Mobile Money, virement ou autre moyen local.

Ranti ne confirme jamais seul qu'un paiement a été reçu.

La validation humaine par le propriétaire reste obligatoire dans le MVP.

### 5. Allocations

Responsabilité : relier une réception de loyer aux échéances qu'elle règle.

Une réception de loyer peut couvrir plusieurs échéances.

Une échéance peut être couverte par plusieurs réceptions de loyer.

Le paiement partiel est représenté par les montants alloués, pas forcément par un statut principal visible.

### 6. Preuves

Responsabilité : conserver les éléments qui justifient une réception de loyer lorsque le propriétaire souhaite les ajouter.

Exemples : capture Mobile Money, reçu bancaire, photo d'un reçu papier.

Une preuve est facultative dans le MVP.

Lorsqu'elle existe, elle doit être reliée à une réception de loyer ou à un contexte métier clair.

Elle ne doit jamais être un fichier isolé sans contexte métier.

### 7. Quittances ou reçus

Responsabilité : générer un document simple après confirmation d'une réception de loyer par le propriétaire.

Une quittance confirme qu'une ou plusieurs échéances sont réglées.

Une quittance ne doit pas être générée avant confirmation par le propriétaire.

### 8. Relances

Responsabilité : aider le propriétaire à rappeler proprement une échéance impayée ou en retard.

Dans le MVP, la relance peut rester manuelle ou semi-manuelle.

L'automatisation complète vient après validation terrain.

## Principes de données

La base de données doit être relationnelle.

Les règles suivantes sont obligatoires :

- chaque donnée sensible doit appartenir à un propriétaire ou à un contexte d'accès clair ;
- une propriété appartient à un propriétaire ou à un espace propriétaire ;
- un logement appartient à une propriété ;
- un bail appartient à un logement, un locataire et un propriétaire ;
- un logement ne peut pas avoir deux baux actifs sur la même période ;
- une échéance appartient toujours à un bail ;
- une réception de loyer appartient au propriétaire qui confirme l'avoir reçue ;
- une réception de loyer règle une ou plusieurs échéances via des allocations ;
- une preuve, lorsqu'elle existe, doit être reliée à une réception de loyer ou à un contexte métier clair ;
- une quittance doit être reliée à une réception confirmée et aux échéances concernées ;
- les actions sensibles doivent laisser une trace d'audit.

Les suppressions destructives doivent être évitées sur les objets financiers.

On privilégie l'archivage, l'annulation ou la correction traçable.

## Principes d'API

Les API doivent refléter les actions métier, pas seulement les écrans et pas seulement du CRUD.

Exemples d'actions métier :

- créer une propriété ;
- créer un logement ;
- créer un bail ;
- générer ou récupérer les échéances ;
- enregistrer une réception de loyer ;
- confirmer une réception de loyer ;
- attacher une preuve facultative ;
- générer une quittance ;
- préparer une relance.

Une API ne doit pas permettre de contourner les règles du domaine.

Par exemple, elle ne doit pas permettre de générer une quittance pour une réception non confirmée.

## Principes de sécurité

Ranti manipule des données sensibles : loyers, identités, preuves de paiement, retards et reçus.

La sécurité minimale doit être présente dès le départ :

- authentification obligatoire pour l'espace propriétaire ;
- téléphone + mot de passe pour les connexions classiques ;
- OTP utilisé pour vérifier le numéro, récupérer l'accès ou sécuriser certaines actions, pas comme friction à chaque connexion ;
- isolation stricte des données par propriétaire ou espace de gestion ;
- contrôle d'accès sur chaque lecture et écriture ;
- stockage contrôlé des fichiers de preuve ;
- liens de fichiers signés ou protégés ;
- journal d'audit pour les actions sensibles ;
- validation serveur des règles métier ;
- aucune confiance aveugle dans les données envoyées par le client.

## Principes d'interface technique

Même si ce document n'est pas un document de design, l'architecture doit servir le mobile-first réel.

Conséquences techniques :

- réponses API courtes et adaptées aux vues mobiles ;
- actions principales rapides ;
- peu de champs obligatoires ;
- parcours tolérants aux connexions instables ;
- chargements progressifs ;
- aucune dépendance à un usage ordinateur pour les actions essentielles.

## Ce que l'architecture refuse pour le MVP

Ranti ne doit pas introduire maintenant :

- microservices ;
- event sourcing complet ;
- moteur comptable avancé ;
- CRM immobilier ;
- marketplace ;
- système complexe de rôles multi-agences ;
- automatisation de recouvrement agressive ;
- analytics avancées ;
- messagerie interne complète ;
- paiement in-app obligatoire ;
- portail locataire complet.

Ces sujets peuvent être réévalués plus tard seulement si le terrain les justifie.

## Position technique initiale

La position technique recommandée pour le départ est :

- application web mobile-first ;
- backend applicatif unique ;
- base relationnelle PostgreSQL ;
- stockage objet pour les preuves et quittances ;
- génération PDF simple pour les reçus ;
- tâches asynchrones limitées aux besoins réels ;
- observabilité minimale : erreurs, logs techniques, audit métier.

Le choix final des outils et fournisseurs doit être documenté dans une ADR séparée.

## Règles anti-dette

Une décision technique crée de la dette si elle :

- contourne le modèle de domaine ;
- rend l'échéance secondaire ;
- confirme un paiement sans validation humaine ;
- rend la preuve obligatoire sans justification terrain ;
- stocke une preuve sans contexte métier ;
- rend le produit difficile à comprendre en moins de cinq secondes ;
- ajoute une sophistication non validée terrain ;
- empêche l'isolation correcte des données ;
- n'est pas documentée dans le dépôt.

## Questions ouvertes

Les sujets suivants doivent être tranchés dans les prochains documents :

1. Générer les échéances à l'avance ou seulement les prochaines échéances ?
2. Comment représenter précisément les paiements partiels dans la base ?
3. Comment représenter une réception de loyer qui couvre plusieurs mois ?
4. Le locataire doit-il avoir un compte ou seulement accéder à des liens simples ?
5. Quel niveau exact d'audit est requis pour le MVP ?
6. Quel fournisseur utiliser pour l'authentification, la base, le stockage et l'hébergement ?

## Prochains documents

1. `docs/database.md`
2. `docs/api.md`
3. `docs/security.md`
4. ADR sur les choix de stack et fournisseurs
