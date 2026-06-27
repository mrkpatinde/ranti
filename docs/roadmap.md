# Ranti Roadmap

Derniere mise a jour : 2026-06-27

## Phase 0 - Foundation

- [x] Vision
- [x] Personas
- [x] Domain Model
- [x] Glossary
- [x] User Journeys
- [x] Product Principles
- [x] Architecture
- [x] ADR-001
- [x] API
- [x] Database
- [x] Initial Schema Migration
- [x] Seed Data
- [x] Row Level Security

## Sprint 2 - Welcome

Objectif : un proprietaire cree son espace Ranti et accede a son tableau de bord vide en moins de 2 minutes.

Decisions auth :

- Identifiant principal : telephone.
- Mot de passe obligatoire.
- OTP uniquement pour verification initiale, recuperation de compte ou action sensible plus tard.
- Pas d OTP a chaque connexion.
- Auth geree par Supabase Auth.
- Domaine metier dans public.landlords, lie a auth.users.

Livrables :

- [x] Authentification Supabase par telephone et mot de passe
- [x] Verification initiale du numero
- [x] Creation du profil proprietaire apres verification
- [x] Completer le profil : civilite, prenom, nom
- [x] Premiere connexion
- [x] Connexion suivante par telephone et mot de passe
- [x] Tableau de bord vide
- [x] Deconnexion
- [x] Tests de bout en bout
- [x] Saisie telephone Benin : prefixe fixe 229, format 01 + 10 chiffres, espacement auto

Note : flux code et teste via Playwright en mode auth local. L'envoi reel des OTP par SMS necessite un provider SMS configure dans Supabase Auth.

## Sprint 3 - Properties

Objectif : permettre au proprietaire de creer son premier lieu a suivre.

- [x] Creer une propriete
- [ ] Modifier une propriete
- [ ] Archiver une propriete

Note : le Sprint 3 commence par le parcours creer ma premiere propriete. La modification et l'archivage restent a faire plus tard.

## Sprint 4 - Units

UI : creation livree (units/new). Le reste existe cote logique metier (actions updateUnit, setUnitAvailability, archiveUnit) mais sans ecran dedie.

- [x] Creer un logement
- [ ] Modifier un logement (logique prete, UI a faire)
- [ ] Changer son statut (logique prete, UI a faire)
- [ ] Archiver un logement (logique prete, UI a faire)

## Sprint 5 - Tenants and Leases

Logique metier livree (createTenant, createLease, activateLease, endLease + migration lease_draft_status). UI proprietaire encore absente (le tableau de bord affiche "Ajouter un locataire" en bientot).

- [ ] Creer un locataire (logique prete, UI a faire)
- [ ] Creer un bail (logique prete, UI a faire)
- [ ] Associer un logement (logique prete, UI a faire)

## Sprint 6 - Rent Cycle

Le coeur metier est en base et audite (SECURITY INVOKER, RLS applique). UI partielle.

- [x] Generer les echeances (generate_rent_dues, declenche a l'activation du bail ; marquage overdue planifie)
- [x] Enregistrer une reception de loyer (record/confirm/cancel + durcissement migration 015)
- [x] Gerer les allocations (allocation obligatoire, controle tenant + logement, paiement partiel non statutaire)
- [~] Vue Encaissements : liste + recuperation des brouillons + confirmer/annuler (UI livree)
- [ ] Formulaire encaisser (saisie + selecteur d'allocations) : UI a faire
- [x] Generer une quittance (generate_receipt / cancel_receipt cote logique)
- [ ] Vue quittances : UI a faire

## Sprint 7 - Beta

- [ ] Tests terrain
- [ ] Corrections
- [ ] Premiere beta privee

## Recent (2026-06-27)

- Durcissement Encaissements (revue PR #33) : allocation obligatoire, controle due.unit_id = unit encaissee, verrous de concurrence (FOR UPDATE), erreurs de requete non masquees, garde-fou anti brouillon orphelin. Migration 015 appliquee.
- Vue Encaissements livree (/collections) : liste, brouillons en tete, confirmer / annuler.
- Saisie telephone Benin : prefixe fixe 229, validation 01 + 10 chiffres, espacement automatique.
- Infra Vercel reparee : monorepo Root Directory = apps/web, vercel.json racine supprime, projets dupliques nettoyes.
