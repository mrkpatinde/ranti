# Ranti — Architecture Technique

## Statut

Version 0.1 — base de travail initiale.

Ce document définit l'architecture technique de départ de Ranti. Il ne remplace pas la Vision, les Personas, le Modèle de Domaine, le Glossaire ou les Principes Produit. Il traduit ces documents en règles techniques simples.

## Objectif technique

Construire Ranti comme un système simple, robuste et compréhensible, capable de protéger la mémoire fiable des loyers sans devenir un CRM immobilier, une marketplace, une banque, un outil comptable complet ou une application de gestion complexe.

L'architecture doit aider le propriétaire à répondre rapidement à trois questions :

1. Qui a payé ?
2. Qui est en retard ?
3. Quelle preuve existe pour chaque paiement ou encaissement ?

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
- protéger la cohérence entre bail, échéance, encaissement, preuve et reçu ;
- permettre une future séparation si le produit prouve un besoin réel.

## Objet central du système

L'objet central du MVP est l'échéance de loyer.

Le système doit être organisé autour de cette chaîne métier :

Propriétaire → Propriété → Logement → Bail → Échéance de loyer → Encaissement → Preuve → Quittance → Relance

Conséquences :

- une échéance existe même si aucun encaissement n'a encore été enregistré ;
- un bail est la source des règles qui créent les échéances ;
- un encaissement peut régler une ou plusieurs échéances ;
- une échéance peut recevoir plusieurs encaissements ;
- une preuve justifie un encaissement ;
- une quittance confirme une ou plusieurs échéances réglées ;
- une relance concerne une échéance non réglée ou en retard.

## Modules métier initiaux

### 1. Identité et accès

Responsabilité : gérer les comptes, les sessions, les permissions et l'isolation des données.

Le propriétaire est le client commercial principal. Le locataire peut interagir avec Ranti plus tard, mais il ne pilote pas le MVP.

### 2. Contexte locatif

Responsabilité : gérer les concepts qui décrivent la relation locative.

Objets concernés : propriétaire, propriété, logement, locataire, bail ou accord locatif.

Le bail relie un propriétaire, un logement et un locataire. Il définit le montant, la périodicité, la date d'échéance, la date de début et éventuellement la date de fin.

### 3. Moteur d'échéances

Responsabilité : créer, suivre et exposer les obligations de loyer attendues.

Le propriétaire ne doit pas créer manuellement chaque échéance mensuelle si le bail permet de les générer.

La génération automatique des échéances doit rester simple au départ : elle doit couvrir le cas mensuel standard avant les cas exceptionnels.

### 4. Encaissements

Responsabilité : enregistrer ce que le propriétaire dit avoir reçu.

Un encaissement est toujours enregistré du point de vue du propriétaire. Il peut être lié à un paiement fait hors Ranti : cash, Mobile Money, virement ou autre moyen local.

Ranti ne confirme jamais seul qu'un paiement a été reçu. La validation humaine par le propriétaire reste obligatoire dans le MVP.

### 5. Preuves

Responsabilité : conserver les éléments qui justifient un paiement ou un encaissement.

Exemples : capture Mobile Money, reçu bancaire, photo d'un reçu papier.

Une preuve doit être reliée à un encaissement. Elle ne doit pas être un fichier isolé sans contexte métier.

### 6. Quittances ou reçus

Responsabilité : générer un document simple après validation d'un encaissement par le propriétaire.

Une quittance confirme qu'une ou plusieurs échéances sont réglées.

Une quittance ne doit pas être générée avant validation de l'encaissement.

### 7. Relances

Responsabilité : aider le propriétaire à rappeler proprement une échéance impayée ou en retard.

Dans le MVP, la relance peut rester manuelle ou semi-manuelle. L'automatisation complète vient après validation terrain.

## Principes de données

La base de données doit être relationnelle.

Les règles suivantes sont obligatoires :

- chaque donnée sensible doit appartenir à un propriétaire ou à un contexte d'accès clair ;
- une échéance doit être reliée à un bail ;
- un bail doit être relié à un logement et à un locataire ;
- un logement doit être relié à une propriété ;
- un encaissement doit être relié à un propriétaire et, quand il sert à régler un loyer, à une ou plusieurs échéances ;
- une preuve doit être reliée à un encaissement ;
- une quittance doit être reliée à l'encaissement validé et aux échéances concernées ;
- les actions sensibles doivent laisser une trace d'audit.

Les suppressions destructives doivent être évitées sur les objets financiers. On privilégie l'archivage, l'annulation ou la correction traçable.

## Principes d'API

Les API doivent refléter les actions métier, pas les écrans.

Exemples d'actions métier :

- créer une propriété ;
- créer un logement ;
- créer un bail ;
- générer ou récupérer les échéances ;
- enregistrer un encaissement ;
- attacher une preuve ;
- valider un encaissement ;
- générer une quittance ;
- préparer une relance.

Une API ne doit pas permettre de contourner les règles du domaine. Par exemple, elle ne doit pas permettre de générer une quittance pour un encaissement non validé.

## Principes de sécurité

Ranti manipule des données sensibles : loyers, identités, preuves de paiement, retards et reçus.

La sécurité minimale doit être présente dès le départ :

- authentification obligatoire pour l'espace propriétaire ;
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
- paiement in-app obligatoire.

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
- stocke une preuve sans contexte métier ;
- rend le produit difficile à comprendre en moins de cinq secondes ;
- ajoute une sophistication non validée terrain ;
- empêche l'isolation correcte des données ;
- n'est pas documentée dans le dépôt.

## Questions ouvertes

Les sujets suivants doivent être tranchés dans les prochains documents :

1. Générer les échéances à l'avance ou seulement les prochaines échéances ?
2. Comment représenter proprement les paiements partiels ?
3. Comment représenter un encaissement qui couvre plusieurs mois ?
4. Le locataire doit-il avoir un compte ou seulement accéder à des liens simples ?
5. Quel niveau exact d'audit est requis pour le MVP ?
6. Quel fournisseur utiliser pour l'authentification, la base, le stockage et l'hébergement ?

## Prochains documents

1. `docs/decisions/adr-001-core-domain-model.md`
2. `docs/database.md`
3. `docs/api.md`
4. `docs/security.md`
