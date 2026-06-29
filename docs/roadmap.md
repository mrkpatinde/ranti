# Ranti Roadmap

Dernière mise à jour : 2026-06-29

## Phase 0 - Foundation

- [x] Vision
- [x] Personas
- [x] Domain Model
- [x] Glossary
- [x] User Journeys
- [x] Product Principles
- [x] Design Brief
- [x] Architecture
- [x] ADR-001
- [x] ADR-006 - Rappels et relances automatiques à partir du bail
- [x] ADR-007 - Reçus et quittances automatiques après validation du paiement
- [x] API
- [x] Database
- [x] Initial Schema Migration
- [x] Seed Data
- [x] Row Level Security

## Sprint 2 - Welcome

Objectif : un propriétaire crée son espace Ranti et accède à son tableau de bord vide en moins de 2 minutes.

Décisions auth :

- Identifiant principal : téléphone.
- Mot de passe obligatoire.
- OTP uniquement pour vérification initiale, récupération de compte ou action sensible plus tard.
- Pas d'OTP à chaque connexion.
- Auth gérée par Supabase Auth.
- Domaine métier dans public.landlords, lié à auth.users.

Livrables :

- [x] Authentification Supabase par téléphone et mot de passe
- [x] Vérification initiale du numéro
- [x] Création du profil propriétaire après vérification
- [x] Compléter le profil : civilité, prénom, nom
- [x] Première connexion
- [x] Connexion suivante par téléphone et mot de passe
- [x] Tableau de bord vide
- [x] Déconnexion
- [x] Tests de bout en bout
- [x] Saisie téléphone Bénin : préfixe fixe 229, format 01 + 10 chiffres, espacement auto

Note : flux codé et testé via Playwright en mode auth local. L'envoi réel des OTP par SMS nécessite un provider SMS configuré dans Supabase Auth.

## Sprint 3 - Properties

Objectif : permettre au propriétaire de créer son premier lieu à suivre.

- [x] Créer une propriété
- [ ] Modifier une propriété
- [ ] Archiver une propriété

Note : le Sprint 3 commence par le parcours créer ma première propriété. La modification et l'archivage restent à faire plus tard.

## Sprint 4 - Units

UI : création livrée (units/new). Le reste existe côté logique métier (actions updateUnit, setUnitAvailability, archiveUnit) mais sans écran dédié.

- [x] Créer un logement
- [ ] Modifier un logement (logique prête, UI à faire)
- [ ] Changer son statut (logique prête, UI à faire)
- [ ] Archiver un logement (logique prête, UI à faire)

## Sprint 5 - Tenants and Leases

UI livrée : /tenants, /tenants/new, /leases, /leases/new, /leases/[id] (détail + activation + fin). Dashboard câblé (CTA réels + étapes Locataire/Bail/Loyers).

- [x] Créer un locataire (UI /tenants/new)
- [x] Créer un bail (UI /leases/new, sélecteurs logement + locataire)
- [x] Associer un logement (choisi à la création du bail)
- [x] Activer / terminer un bail (UI /leases/[id])

## Sprint 6 - Rent Cycle

Flux boucle de bout en bout (UI + DB). Coeur métier audité (SECURITY INVOKER, RLS appliqué).

- [x] Générer les échéances (generate_rent_dues à l'activation du bail ; visibles sur /leases/[id] ; marquage overdue planifié)
- [x] Enregistrer une réception de loyer (record/confirm/cancel + durcissement migration 015)
- [x] Gérer les allocations (allocation obligatoire, contrôle tenant + logement, paiement partiel non statutaire)
- [x] Vue Encaissements (/collections) : liste, brouillons en tête, confirmer/annuler
- [x] Formulaire encaisser (/collections/new : bail actif -> allocation aux échéances impayées)
- [x] Générer une quittance (generate_receipt depuis encaissement confirmé)
- [x] Vue quittances (/receipts + /receipts/[id] : détail, périodes réglées, annuler)

Reste : UI modifier/archiver (units, properties, tenants), dashboard mensuel de synthèse (payés / en retard / action), gestion visible des retards/relances.

## Sprint 7 - Reminder Engine

Objectif : Ranti prépare ou automatise les rappels et relances à partir du bail et des échéances.

- [ ] Définir les règles de rappel/relance sur un bail
- [ ] Afficher les règles sur la fiche bail
- [ ] Générer les relances prévues à partir des échéances
- [ ] Afficher les relances prévues/envoyées sur le dashboard
- [ ] Afficher l'historique des relances sur la fiche locataire ou bail
- [ ] Préparer le message WhatsApp/SMS sans envoi automatique complet au MVP prudent
- [ ] Auditer création, annulation, file d'attente et envoi de relance

## Sprint 8 - Proof Engine

Objectif : après validation du paiement par le propriétaire, Ranti génère automatiquement le document adapté.

- [ ] Transformer l'action produit principale en "valider le paiement"
- [ ] Annoncer le document généré avant validation
- [ ] Générer automatiquement un reçu partiel si paiement partiel
- [ ] Générer automatiquement une quittance/reçu complet quand l'échéance est soldée
- [ ] Conserver le snapshot du document généré
- [ ] Vérifier la numérotation unique par propriétaire
- [ ] Auditer génération, annulation et remplacement

## Sprint 9 - Beta

- [ ] Tests terrain
- [ ] Corrections
- [ ] Première beta privée

## Recent (2026-06-29)

- Cadrage produit mis à jour : Ranti est un registre de loyer actif.
- Ajout du Design Brief pour Claude Design.
- Ajout ADR-006 : rappels et relances automatiques à partir du bail.
- Ajout ADR-007 : reçus et quittances automatiques après validation du paiement.
- Reminder Engine et Proof Engine deviennent les deux moteurs produit du MVP.

## Recent (2026-06-27)

- Durcissement Encaissements (revue PR #33) : allocation obligatoire, contrôle due.unit_id = unit encaissée, verrous de concurrence (FOR UPDATE), erreurs de requête non masquées, garde-fou anti brouillon orphelin. Migration 015 appliquée.
- Vue Encaissements livrée (/collections) : liste, brouillons en tête, confirmer / annuler.
- Saisie téléphone Bénin : préfixe fixe 229, validation 01 + 10 chiffres, espacement automatique.
- Infra Vercel réparée : monorepo Root Directory = apps/web, vercel.json racine supprimé, projets dupliqués nettoyés.
- Flux propriétaire boucle de bout en bout : UI locataire, bail (création/activation/fin), échéances visibles, formulaire encaisser avec allocation, vue + détail quittances. Dashboard câblé.
- Vrai logo Ranti (mark lignes de carnet) en favicon ; oeil afficher/masquer mot de passe ; messages auth explicites (compte existant / provider téléphone désactivé).
- Note : login bloqué tant que le provider Telephone Supabase Auth n'est pas activé (config dashboard).
