# Ranti Roadmap

Derniere mise a jour : 2026-06-26

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

Note : flux code et teste via Playwright en mode auth local. L'envoi reel des OTP par SMS necessite un provider SMS configure dans Supabase Auth.

## Sprint 3 - Properties

Objectif : permettre au proprietaire de creer son premier lieu a suivre.

- [x] Creer une propriete
- [ ] Modifier une propriete
- [ ] Archiver une propriete

Note : le Sprint 3 commence par le parcours creer ma premiere propriete. La modification et l'archivage restent a faire plus tard.

## Sprint 4 - Units

- [ ] Creer un logement
- [ ] Modifier un logement
- [ ] Changer son statut
- [ ] Archiver un logement

## Sprint 5 - Tenants and Leases

- [ ] Creer un locataire
- [ ] Creer un bail
- [ ] Associer un logement

## Sprint 6 - Rent Cycle

- [ ] Generer les echeances
- [ ] Enregistrer une reception de loyer
- [ ] Gerer les allocations
- [ ] Generer une quittance

## Sprint 7 - Beta

- [ ] Tests terrain
- [ ] Corrections
- [ ] Premiere beta privee
