# Ranti Roadmap

Dernière mise à jour : 2026-07-11

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

Mise à jour 2026-07-10 (ADR-010) : l'auth téléphone + mot de passe est gelée. Inscription et connexion passent uniquement par Google, tous pays. Le code téléphone/OTP est conservé pour un dégel futur.

Mise à jour 2026-07-10 (ADR-011) : l'onboarding profil accepte les numéros mobiles Bénin, Sénégal et Côte d'Ivoire (sélecteur d'indicatif alimenté par le registre des pays). Nouveau pays = nouvelle entrée dans le registre.

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

## Recent (2026-07-12)

- Corrections terrain profil + preuve (PR #122). (1) Civilité retirée de l'UI.
  (2) Déconnexion accessible sur mobile (bouton sur `/settings/profile` ; il
  n'existait que dans la sidebar desktop masquée en mobile). (3) Entrée
  « Profil » renommée « Paramètres » (desktop + mobile). (4) Preuve à deux voix
  après collage SMS MoMo : le flux surface désormais « Envoyer au locataire »
  (partage du lien `/recu/[token]`), et le locataire peut télécharger le PDF
  via la nouvelle route publique `/recu/[token]/pdf` (même frontière de
  confiance token que la page, RPC SECURITY DEFINER, aucun service-role).
  Vérifié live : le PDF token renvoie `200 application/pdf`.
- Corrections terrain vocal + onboarding (PR #121, ADR-016). (1) Vocal : le
  montant entendu (« 80 000 en complément ») est désormais porté jusqu'au
  formulaire d'encaissement (pré-remplissage + ventilation plus ancienne
  échéance d'abord) — avant il était perdu. (2) Garde-fou anti-hallucination :
  un nom absent de la base ne génère plus de quittance pour le mauvais
  locataire (le nom entendu doit recouper le locataire du bail). (3+4) Flux
  création raccourci : loyer/jour par défaut sur le logement (migration
  `20260712030000`, défaut de saisie — le bail reste maître) pré-remplissent le
  bail ; `/units/new` gagne un interrupteur « déjà occupé » qui crée
  locataire + bail en un écran via `bulk_onboard_portfolio`.
- Landing réécrite en voix « je » : le propriétaire se projette (« Je dicte ou je
  colle mon SMS MoMo, l'IA écrit, mon locataire confirme »). Flux ADR-014 intégré
  (collage SMS MoMo, journal de bord). Cadrage relances corrigé partout, meta
  description incluse : Ranti prépare le message, le propriétaire l'envoie via
  WhatsApp (`wa.me` sortant) — plus de « relances automatiques ».
- ADR-015 versionnée : authentification WhatsApp proposée, recommandation
  Option A (Google-only conservé, WhatsApp exclusivement sortant).
- Outillage npm → bun (PR #118) : scripts racine, `bun.lock` unique (Vercel et
  CI installent pareil), CI sur `setup-bun` — lint+test+build en 33 s.

## Recent (2026-07-11)

- ADR-014 — Journal de bord + collage SMS MoMo (briques base). Appliqué live
  (migration `20260711140000_sms_paste_and_journal_feed.sql`) : vue de projection
  `journal_feed` (`security_invoker=true` + grant `authenticated`) unionnant
  leases / rent_dues / rent_receptions / receipts / reminders + reminder_events
  en flux chronologique — **pas** de table `journal_events`, zéro double écriture.
  Dédup du SMS collé deux fois via index unique partiel `(landlord_id,
  payment_reference)` — réutilise la colonne `payment_reference` existante,
  aucune colonne ajoutée. Route `POST /api/sms/collection` (jumelle du vocal
  ADR-012 : Gemini flash-lite Structured Outputs, `lease_id` re-validé serveur,
  aucune écriture en base) + `lib/sms`. Restant : bottom-sheet + page journal +
  design monochrome. `GEMINI_API_KEY` déjà en prod.
- ADR-014 (suite) — **Accueil journal unifié** livré (PR #110, 2026-07-12).
  `/dashboard` rend désormais la timeline chronologique : en-tête sobre + deux
  gestes de capture (vocal + collage SMS MoMo) + flux. Supprimés : bandeau
  d'étapes et blocs de statistiques. Propriétaire sans bail actif → geste
  d'accueil unique (welcome-flow.md verrouillé). `/journal` redirige vers
  `/dashboard` (route dédoublée retirée, pas de boucle) ; nav « Suivi » nettoyée.
  Timeline enrichie du lien `wa.me` sortant par ligne d'encaissement : migration
  `20260711170000_journal_feed_counterparty_phone.sql` (colonne `counterparty_phone`
  ajoutée en fin de vue, `security_invoker` préservé, grant re-émis) **appliquée
  live** (ref `pcxkxeesgusorrpmrkaj`, vérifiée). Gate inchangé : Google + ≥ 1 bail actif.

- Landing alignée sur la nouvelle architecture (ADR-012 + ADR-013) : hero,
  piliers (vocal / relances / preuve à deux voix), parcours en 4 temps (dictez →
  l'IA remplit → vous validez → le locataire confirme), comparatif (lignes
  vocal + preuve à deux voix), section « Pourquoi Ranti » et FAQ (comment
  dicter, l'IA peut-elle se tromper, contestation locataire). Copie seule, aucun
  changement de logique/DB. Formulaire manuel toujours présenté comme filet.

- ADR-012 — Saisie vocale des encaissements (effet Granola). Bouton micro
  push-to-talk sur le tableau de bord → `POST /api/voice/collection` →
  Gemini 2.5 Flash-lite (Structured Outputs) résout la phrase vers UN bail
  actif du portefeuille. Le serveur **re-valide** que le `lease_id` renvoyé
  appartient au propriétaire (jamais de confiance aveugle au modèle) ; carte de
  validation, aucune écriture en base — l'écriture reste `/collections/new`
  (record → confirm → generate_receipt). Audio non conservé, clé
  `GEMINI_API_KEY` serveur uniquement. Fallback systématique vers le formulaire
  manuel (pas de micro, refus, échec Gemini, clé absente). Prérequis prod :
  définir `GEMINI_API_KEY` dans Vercel (sinon dégradation propre vers manuel).

- ADR-013 — Contestation locataire & statuts probants du reçu (Sprint 8 Proof
  Engine). Nouveau cycle d'acquittement `receipts.tenant_ack`
  (`unilateral`/`read`/`certified`/`disputed`), orthogonal au cycle de vie
  `issued`/`cancelled`. Accès public par token : route `/(public)/recu/[token]`
  + 3 RPC `SECURITY DEFINER` (`get_receipt_by_token` pose `read` à la 1re
  ouverture, `certify_receipt_by_token` → `certified` + empreinte SHA-256 UTC
  déterministe, `contest_receipt_by_token` → `disputed`, version locataire
  isolée, non re-contestable). L'anon n'accède à aucune table. PDF « deux voix »
  (bandeau par statut, bloc version locataire, empreinte si certifié). Écran
  propriétaire : badge d'acquittement + partage WhatsApp du lien `/recu/token`.
  Liste des reçus : badges Ouvert/Certifié/Contesté + alerte contestation.
  Coexiste avec ADR-005 (remplacement → nouveau token, `unilateral`).
  Migration `20260711120000` validée contre le schéma live (transaction
  rollback). Validation extraite en fonction pure testable (`lib/receipts/contest.ts`,
  9 tests). Build OK, 143 tests verts, lint 0.

## Recent (2026-07-10)

- Refonte du code couleur sur la palette Granola (granola.ai) : surface blanc cassé #f7f7f2, encre anthracite #292929, accent vert olive #5b6f00 (CTA), teintes vertes douces pour les états. Tokens globals.css (light + dark), landing, écrans app, favicon, logo, PDF quittance alignés. Correctifs contraste AA (panneau sombre, dark mode).
- CTA landing : « Gérer mes loyers » remplace « Créer mon espace » (verbe orienté action métier).

## Recent (2026-07-05)

- Alias PI-SPI (Tier 1) : le propriétaire renseigne son alias de paiement PI-SPI
  (`/settings/payment`, donnée mutable hors identité verrouillée ADR-002). L'alias
  s'affiche sur l'écran d'encaissement et sur la page publique `/confirmer` du
  locataire (RPC `get_rent_due_by_token` étendue, migration `20260705140000`). Le
  locataire paie directement, instantané et gratuit ; Ranti ne détient jamais les
  fonds — aucun agrément EME/EDP requis. L'injection de l'alias dans le SMS de
  relance (ADR-006, cron, ranti-ops) est volontairement reportée (gel features,
  risque pipeline live). Voir ADR-009. Contexte : MTN MoMo Bénin connecté à PI-SPI
  depuis le 28/06/2026 (Moov + MTN + banques = couverture locataire OK).
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
