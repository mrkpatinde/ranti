# Ranti — Principes d'Architecture

## Statut

Version 1.0 — base de travail technique.

Ce document définit les principes d'architecture qui guident les décisions techniques de Ranti.

Il complète la Fondation Produit et doit être lu avant toute décision concernant la base de données, les API, l'authentification, les intégrations, les notifications, les reçus ou l'organisation du code.

## Source de vérité

Les décisions techniques de Ranti doivent respecter les documents suivants :

- `docs/vision.md`
- `docs/personas.md`
- `docs/domain-model.md`
- `docs/glossary.md`
- `docs/user-flows.md`
- `docs/principes.md`

Si une décision technique contredit ces documents, elle est rejetée.

Si une décision n'est pas encore couverte par ces documents, elle doit être explicitement notée dans `docs/decisions/` avant d'être considérée comme stable.

## Langue et vocabulaire

La documentation produit et architecture est rédigée en français clair.

Le code, les noms de tables, les routes API, les variables et les modules utilisent l'anglais simple.

Le vocabulaire technique doit rester aligné avec le glossaire métier.

Exemples de correspondance :

| Terme métier | Nom technique recommandé |
| --- | --- |
| Propriétaire | `landlord` |
| Propriété | `property` |
| Logement | `unit` |
| Locataire | `tenant` |
| Bail | `lease` |
| Relation locative | `rental_relationship` |
| Échéance de loyer | `rent_due` ou `rent_installment` |
| Encaissement | `collection` |
| Paiement | `payment` |
| Preuve de paiement | `payment_proof` |
| Quittance ou reçu | `receipt` |
| Relance | `reminder` |

La règle est simple :

> Français pour penser le produit. Anglais simple pour construire le système.

## Philosophie d'architecture

Ranti doit être une application simple, robuste et fidèle au domaine métier.

L'architecture ne doit pas être construite autour d'un dashboard, d'un prestataire de paiement, d'un framework ou d'une vision SaaS abstraite.

Elle doit être construite autour du cycle réel de gestion du loyer :

1. un propriétaire possède ou gère une propriété ;
2. une propriété contient un ou plusieurs logements ;
3. un locataire occupe un logement ;
4. un bail définit les règles de la relation locative ;
5. une échéance de loyer naît à partir du bail ;
6. un encaissement peut régler tout ou partie d'une échéance ;
7. une preuve peut documenter l'encaissement ;
8. une quittance ou un reçu peut être généré après validation ;
9. une relance peut être envoyée si l'échéance reste impayée ou en retard ;
10. chaque action importante laisse une trace.

L'architecture doit protéger cette chaîne.

## Principe 1 — Domaine avant technologie

Le domaine métier guide l'architecture.

Les concepts du modèle de domaine doivent être visibles dans :

- la structure de la base de données ;
- les routes API ;
- les services métier ;
- les permissions ;
- les événements ;
- les logs d'audit ;
- les écrans principaux.

Un développeur doit pouvoir lire le code et reconnaître les concepts métier de Ranti.

Ranti ne doit pas introduire des abstractions techniques qui masquent les objets importants du produit.

## Principe 2 — L'échéance de loyer est l'objet central du MVP

Dans le MVP, l'échéance de loyer est le centre du système.

Ce n'est pas le paiement, le reçu, le bien immobilier ou le dashboard qui pilotent l'architecture.

Le système doit permettre de répondre clairement, pour chaque échéance :

- qui devait payer ;
- quel logement est concerné ;
- quelle période est concernée ;
- combien était attendu ;
- combien a été encaissé ;
- ce qui reste dû ;
- quelle preuve existe ;
- si une quittance peut être générée ;
- si une relance est nécessaire.

Toute architecture qui rend cette réponse difficile est une mauvaise architecture.

## Principe 3 — Simplicité radicale

Ranti doit utiliser des choix techniques simples, connus et maintenables.

Le MVP doit pouvoir être compris et maintenu par une petite équipe.

Ranti refuse :

- les microservices prématurés ;
- les abstractions inutiles ;
- les workflows complexes ;
- les dashboards analytiques avancés ;
- les architectures pensées pour impressionner ;
- les dépendances critiques sans nécessité ;
- les couches techniques qui ne protègent pas le domaine.

La sophistication doit venir du terrain, pas de l'imagination technique.

## Principe 4 — Monolithe modulaire au départ

Ranti doit commencer comme un monolithe modulaire.

Le déploiement doit rester simple.

Le code doit cependant être organisé par domaines clairs.

Modules recommandés au départ :

- `auth`
- `landlords`
- `properties`
- `units`
- `tenants`
- `leases`
- `rent_dues`
- `collections`
- `payment_proofs`
- `receipts`
- `reminders`
- `notifications`
- `audit_logs`

Ces modules ne sont pas forcément des services séparés.

Ils sont d'abord des frontières de compréhension dans le code.

## Principe 5 — Une seule source de vérité par concept critique

Chaque concept critique doit avoir une source de vérité claire.

Exemples :

- le bail définit les règles de génération des échéances ;
- l'échéance de loyer porte l'obligation attendue ;
- l'encaissement représente ce que le propriétaire déclare avoir reçu ;
- la preuve documente un encaissement ou un paiement ;
- la quittance confirme une ou plusieurs échéances réglées ;
- la relance documente une action de rappel.

Les données dérivées sont autorisées pour simplifier l'expérience ou améliorer les performances, mais elles ne doivent jamais remplacer la source de vérité.

## Principe 6 — Validation humaine dans le MVP

Pour le MVP, le propriétaire reste la personne qui confirme qu'un encaissement a réellement été reçu.

Ranti peut aider à enregistrer, structurer, afficher, relancer et générer des reçus.

Mais Ranti ne doit pas inventer un encaissement, confirmer une réception sans validation, ou remplacer la relation propriétaire-locataire.

Les intégrations de paiement pourront améliorer cette validation plus tard, mais elles ne doivent pas contrôler le domaine.

## Principe 7 — Prestataires externes remplaçables

Les prestataires externes sont des adaptateurs, pas le coeur du système.

Cela concerne notamment :

- Mobile Money ;
- agrégateurs de paiement ;
- WhatsApp ;
- SMS ;
- email ;
- génération PDF ;
- stockage de fichiers.

Ranti doit pouvoir évoluer sans reconstruire son modèle de domaine lorsqu'un prestataire change.

Le coeur du système doit savoir gérer :

- encaissement cash ;
- encaissement Mobile Money ;
- encaissement par virement ;
- encaissement partiel ;
- encaissement manuel ;
- encaissement associé à une preuve ;
- encaissement validé par le propriétaire.

## Principe 8 — Traçabilité obligatoire des actions sensibles

Ranti manipule des loyers, des preuves, des retards et des reçus.

Toute action sensible doit laisser une trace.

Exemples d'actions à auditer :

- création d'un propriétaire ;
- création ou modification d'une propriété ;
- création ou modification d'un logement ;
- création ou modification d'un bail ;
- génération d'une échéance ;
- enregistrement d'un encaissement ;
- modification ou annulation d'un encaissement ;
- ajout ou suppression d'une preuve ;
- génération d'une quittance ou d'un reçu ;
- envoi d'une relance ;
- changement de statut d'une échéance ;
- changement de rôle ou de permission.

Les logs d'audit doivent permettre de comprendre ce qui s'est passé, quand, par qui, et sur quel objet.

## Principe 9 — Sécurité et séparation des données dès le départ

Ranti doit être sécurisé dès la première version.

Règles minimales :

- un propriétaire ne peut pas accéder aux données d'un autre propriétaire ;
- un locataire ne peut pas voir les données privées d'un autre locataire ;
- les preuves de paiement doivent être protégées ;
- les reçus doivent être accessibles uniquement aux parties concernées ;
- les actions sensibles doivent être autorisées côté serveur ;
- les entrées utilisateur doivent être validées ;
- les liens publics doivent être limités, traçables et révocables si nécessaire.

La sécurité ne doit pas dépendre uniquement de l'interface.

## Principe 10 — États explicites plutôt que booléens ambigus

Les états métier doivent être explicites.

Éviter les champs ambigus comme :

- `isPaid`
- `isLate`
- `isConfirmed`
- `isValidated`

Préférer des statuts métier compréhensibles.

Exemples pour une échéance :

- `upcoming`
- `due`
- `partially_collected`
- `collected`
- `overdue`
- `cancelled`
- `disputed`

Exemples pour un encaissement :

- `draft`
- `pending_confirmation`
- `confirmed`
- `cancelled`
- `reversed`

Les états exacts seront définis dans le document de base de données ou dans une décision technique dédiée.

## Principe 11 — Quittance déterministe

Une quittance ou un reçu doit être généré à partir de données confirmées.

Une quittance doit référencer clairement :

- le propriétaire ;
- le locataire ;
- le logement ;
- le bail ou la relation locative ;
- l'échéance ou les échéances concernées ;
- le montant encaissé ;
- la période couverte ;
- la méthode d'encaissement ;
- la date d'encaissement ;
- le numéro de quittance ou reçu ;
- la date de génération.

Une quittance générée ne doit pas être modifiée silencieusement.

Si une correction est nécessaire, le système doit garder une trace de l'ancienne version ou créer un flux de correction.

## Principe 12 — Pas de suppression silencieuse des données critiques

Les données critiques ne doivent pas être supprimées sans trace.

Cela concerne notamment :

- les baux ;
- les échéances ;
- les encaissements ;
- les preuves ;
- les quittances ;
- les relances ;
- les logs d'audit.

Le système peut masquer, archiver, annuler ou clôturer un élément, mais il doit préserver l'historique lorsque l'élément concerne une obligation de loyer, un encaissement, une preuve ou un reçu.

## Principe 13 — Mobile-first réel

Ranti est conçu pour des propriétaires qui peuvent gérer leurs loyers depuis un téléphone.

L'architecture doit soutenir :

- des pages rapides ;
- des formulaires courts ;
- des actions principales claires ;
- une faible consommation de données ;
- des erreurs compréhensibles ;
- des partages simples de reçus ou de relances ;
- une expérience utilisable sans ordinateur.

Une architecture qui impose une expérience lourde ne respecte pas Ranti.

## Principe 14 — WhatsApp est un canal, pas la base de données

WhatsApp peut servir à :

- envoyer une relance ;
- partager un reçu ;
- recevoir ou transmettre une preuve ;
- ouvrir un lien vers Ranti ;
- faciliter la communication propriétaire-locataire.

Mais WhatsApp ne doit pas être la source de vérité.

La mémoire fiable des loyers doit rester dans Ranti.

Tout message important envoyé via WhatsApp doit pouvoir être relié à un objet du domaine : échéance, encaissement, preuve, quittance ou relance.

## Principe 15 — Règles métier côté serveur

Les règles métier critiques ne doivent pas vivre uniquement dans l'interface.

Elles doivent être appliquées côté serveur ou dans une couche domaine claire.

Exemples de règles métier :

- générer une échéance à partir d'un bail ;
- calculer le reste dû ;
- décider si une échéance est en retard ;
- confirmer un encaissement ;
- autoriser la génération d'une quittance ;
- empêcher une quittance sans encaissement confirmé ;
- tracer une relance ;
- préserver l'historique après modification.

L'interface peut guider l'utilisateur, mais elle ne doit pas être le seul garde-fou.

## Principe 16 — Maintenance avant scale

Le premier objectif de Ranti n'est pas de supporter des millions d'utilisateurs.

Le premier objectif est de construire un système correct, lisible, sûr et maintenable.

L'architecture doit faciliter :

- l'ajout d'une méthode d'encaissement ;
- l'ajout d'un canal de notification ;
- l'ajout d'un pays ;
- l'ajout d'une langue ;
- l'évolution vers un espace locataire ;
- l'évolution vers des gestionnaires locaux ;
- la génération plus avancée de quittances ;
- l'intégration future de paiements en ligne.

Mais ces possibilités futures ne doivent pas alourdir le MVP.

## Règles de décision technique

Avant d'ajouter une technologie, une table, une API, une intégration ou une abstraction, il faut répondre à ces questions :

1. Est-ce que cela aide le propriétaire à savoir qui a payé, qui est en retard, ou quelle preuve existe ?
2. Est-ce relié à un parcours utilisateur validé ?
3. Est-ce cohérent avec le modèle de domaine ?
4. Est-ce compréhensible par une petite équipe ?
5. Est-ce que cela protège la fiabilité des loyers ?
6. Est-ce que cela réduit ou augmente la complexité ?
7. Est-ce que cela crée une dette technique ou produit inutile ?
8. Est-ce que cette décision peut être expliquée simplement dans `docs/decisions/` ?

Si la réponse est faible, la décision doit être rejetée ou reportée.

## Non-négociables

1. Aucun utilisateur ne doit accéder aux données privées d'un autre utilisateur.
2. Aucune quittance ne doit être générée sans encaissement confirmé.
3. Aucun encaissement critique ne doit disparaître sans trace.
4. Aucun prestataire externe ne doit contrôler le modèle de domaine.
5. Aucune fonctionnalité ne doit entrer dans le MVP sans lien avec un parcours utilisateur.
6. Aucune règle métier critique ne doit dépendre uniquement de l'interface.
7. Aucune terminologie technique ne doit contredire le glossaire.
8. Aucune architecture ne doit rendre Ranti plus difficile à utiliser qu'un cahier simple.
9. Aucune sophistication ne doit remplacer la validation terrain.
10. Aucune décision importante ne doit rester seulement dans une conversation.

## Direction technique du MVP

La direction recommandée pour le MVP est :

- application web mobile-first ;
- backend monolithique modulaire ;
- base de données relationnelle ;
- authentification simple et sécurisée ;
- isolation stricte des données par propriétaire ;
- logique métier côté serveur ;
- génération d'échéances à partir des baux ;
- encaissements validés par le propriétaire ;
- preuves de paiement protégées ;
- quittances générées de manière déterministe ;
- relances traçables ;
- logs d'audit pour les actions sensibles ;
- intégrations externes isolées dans des adaptateurs ;
- déploiement simple ;
- observabilité minimale dès le départ.

## Phrase de contrôle

L'architecture de Ranti doit être simple, lisible, sûre et fidèle au cahier de loyers réel.

Si une décision rend Ranti plus confus, moins fiable ou plus difficile à maintenir, elle est mauvaise.
