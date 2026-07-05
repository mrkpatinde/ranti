# Ranti Roadmap

Dernière mise à jour : 2026-07-05

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
- [x] Ajouter plusieurs logements d'un coup (onboarding groupé /units/bulk, avec locataire+bail+échéances optionnels, RPC atomique bulk_onboard_portfolio)
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
- [x] Générer les relances prévues à partir des échéances (cron quotidien /api/cron/reminders, fenêtres J-5/J-1/J-0/J+3/J+10)
- [ ] Afficher les relances prévues/envoyées sur le dashboard
- [x] Écran Relances (/reminders) : historique des relances envoyées + accès aux déclarations locataires à valider
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

## Recent (2026-07-05)

- Landing : section comparatif (PR #91) sur la page publique — tableau Ranti vs
  cahier + WhatsApp vs tableur Excel (6 lignes = les 5 questions produit + Reminder/Proof
  engine), notes nuancées côté alternatives (comparatif honnête), cadrage relances
  (« sans y penser ») et vocabulaire glossaire respectés. Colonne Ranti mise en avant,
  table scrollable sur mobile. Additif marketing, aucune logique métier / DB touchée.
- Onboarding groupé (PR #89) : écran propriétaire `/units/bulk` pour ajouter plusieurs
  logements d'un coup, chacun optionnellement avec locataire + bail activé + échéances.
  RPC atomique `bulk_onboard_portfolio` (SECURITY INVOKER, réutilise
  `activate_lease`/`generate_rent_dues`, tout-ou-rien). Corrige le cul-de-sac du flux
  unitaire (un logement -> création locataire forcée). 126 tests verts.
- Fix relances côté propriétaire : l'écran `/reminders` plantait (server error) car
  `reminder_events` avait la policy SELECT du propriétaire mais aucun grant table pour
  `authenticated` (403 « permission denied » avant RLS). Grant SELECT ajouté (migration
  `20260705130000`) ; la policy scope déjà aux lignes du propriétaire.
- Sprint instrumentation + lien /confirmer dans les relances : mergés et déployés
  (ranti #88, ranti-ops #1).

## Recent (2026-07-03)

- Review complète A à Z : build OK, 117 tests verts, lint 0 erreur, sécurité cœur validée
  (RPC token SECURITY DEFINER + grants stricts, cron service-role, local-auth bloqué en prod,
  vues ops sans accès anon/authenticated).
- Migrations ops rapatriées dans ce repo (`create_ops_reminders`, `ops_dashboard_views`) :
  fin de la dérive cross-repo avec ranti-ops ; `supabase db reset` rejoue tout le schéma.
- Perf RLS `landlords` : `auth.uid()` enveloppé dans un sous-select (advisor auth_rls_initplan),
  migration `landlords_rls_initplan` appliquée en live.
- Relance jour J : nouveau template `j-0` (« dû aujourd'hui ») — le SMS ne dit plus « demain »
  le jour de l'échéance. Tests unitaires des fenêtres de relance ajoutés.
- Assistance propriétaire : liens WhatsApp/email dans le shell et le profil ; lien WhatsApp
  masqué si `NEXT_PUBLIC_SUPPORT_WHATSAPP` absent (plus de numéro bidon).
- Branche pays SN/CI (ADR-008) : inscription Google-only Sénégal & Côte d'Ivoire, en cours de PR.

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
