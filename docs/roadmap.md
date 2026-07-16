# Ranti Roadmap

Dernière mise à jour : 2026-07-15

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
- [x] Modifier une propriété (UI /properties/[id]/edit)
- [x] Archiver une propriété (/properties/[id] : panneau visible + confirmation, bloqué si un logement a un bail actif)

## Sprint 4 - Units

UI livrée : création (units/new), édition, changement de statut et archivage.

- [x] Créer un logement
- [x] Ajouter plusieurs logements d'un coup (onboarding groupé /units/bulk, avec locataire+bail+échéances optionnels, RPC atomique bulk_onboard_portfolio)
- [x] Modifier un logement (UI /units/[id]/edit)
- [x] Changer son statut (toggle disponible/occupé sur /units/[id], setUnitAvailability)
- [x] Archiver un logement (/units/[id] : panneau visible + confirmation, bloqué si bail actif)

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

Reste : dashboard mensuel de synthèse (payés / en retard / action), gestion visible des retards/relances. (UI modifier/archiver units/properties/tenants livrée — édition + archivage confirmé + statut logement.)

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

## Recent (2026-07-16)

- Rail FeexPay branché côté serveur (branche `feexpay-integration-remaining`,
  non encore versionné) : squelette client `src/lib/feexpay/` (config null-safe,
  signature webhook HMAC, checkout plein montant, payout + polling V2,
  normalisation) et webhook `POST /api/payments/notification` re-câblé de
  Kkiapay vers le rail FeexPay (ADR-019, cash-in unique). Le webhook INGÈRE
  seulement (`pending`) — la validation propriétaire (ADR-017) reste la porte.
  Code Kkiapay orphelin retiré ; l'enum ledger conserve `kkiapay`/`fedapay`
  (historique). **Sandbox uniquement** (`FEEXPAY_ENV=sandbox`), activation prod
  toujours gatée BCEAO. Reste avant go-live : compte sandbox FeexPay + confirmer
  endpoints/champs/en-tête signature (isolés, « fix une ligne »), puis aligner
  le wording paiement de l'app et outiller le déclenchement checkout locataire.

- Wording alias aligné sur ADR-019 (v0.3.4.8, CEO) : `/settings/payment` retire
  « Ranti ne touche jamais l'argent » (abandonné comme cible produit), garde
  « en un instant, sans frais pour le locataire » (vrai alias ET rail). Glossaire :
  alias = filet, rail FeexPay = cible gatée BCEAO. FeexPay non branché → aucune
  mention de rail actif. Alignement niveau 1 ; bascule complète au go-live rail.

- ADR-019 « Rail FeexPay obligatoire » consignée (v0.3.4.7) : formalise en docs
  la décision CEO du 2026-07-15 (FeexPay = PSP ; rail = seul cash-in, 0 surcharge
  locataire, 95 % reversé ; fractionné/SMS/vocal abandonnés ; alias en filet ;
  activation gatée BCEAO). Docs-first avant d'aligner le wording paiement de
  l'app — à valider CEO, puis alignement app en suivant.

## Recent (2026-07-15)

- Fix contraste badge « Attendu » + encadrés info (v0.3.4.6, retour CEO) : le
  texte `text-accent-foreground` (encre/crème, pour texte sur olive plein)
  devenait invisible sur `bg-accent/10` dans les deux thèmes → passé à
  `text-accent`. 6 fichiers (badge échéance + 5 encadrés info).

- CTA en pill à gauche sur desktop (v0.3.4.5, directive CEO) : les actions/
  soumissions qui s'étiraient pleine largeur dans les pages `flex-col` prennent
  leur largeur de contenu au-delà de lg (`lg:w-fit`, 7 CTA), comme le dashboard.
  Mobile inchangé. Finalise la refonte desktop Granola.

- Refonte desktop « Granola » propagée à toutes les pages (v0.3.4.4, CEO
  « c'est bon, propage ») : respiration desktop (`lg:py-14`) + titres éditoriaux
  (`lg:text-4xl`) sur les ~20 écrans (app). Les listes gardent `max-w-3xl`, les
  formulaires `max-w-md` ; mobile inchangé. Suite du flagship v0.3.4.3.

- Refonte desktop éditoriale « Granola » — flagship dashboard (v0.3.4.3,
  directive CEO) : le desktop passait un écran mobile (colonne 448 px) dans un
  canevas large → colonne centrée confortable (672 px) au-delà de lg, « Bonjour »
  agrandi (Fraunces), carte stats focale, lignes aérées, CTA en pill à gauche.
  Mobile inchangé. Référence à propager aux autres pages (Encaissements, Baux,
  détails…) après validation CEO du rendu flagship.

- Retour mobile + fin du « Ranti » doublé (v0.3.4.2, retour CEO) : bouton
  retour (‹) dans le header mobile (repli accueil si pas d'historique), et la
  ligne « Ranti » redondante retirée des en-têtes de page (le shell la porte
  déjà ; la marque du document quittance reste intacte).

- Nav mobile rangée + profil unifié (v0.3.4.1, directive CEO) : la barre
  d'onglets qui débordait (Accueil / Encaissements / Relances / Baux) passe dans
  un bouton menu en haut à droite ; l'avatar profil à côté ouvre Paramètres +
  Se déconnecter (déconnexion visible d'un tap). Bouton « Paramètres » séparé et
  menu compte du dashboard retirés — un seul profil sur toutes les pages, shell
  desktop inchangé.

- Dashboard propriétaire en lecture seule + onboarding bail-centric (v0.3.4.0,
  ADR-020/ADR-019, PR #142) : l'accueil devient « qui a payé / qui doit »
  (totaux payé/attendu/retard, liste à encaisser retards d'abord, action unique
  « Créer un bail ») ; les blocs vocal + collage SMS et le journal disparaissent
  de l'accueil (encaissement = rail FeexPay). Onboarding recentré sur un écran
  unique « Créer un bail » (lieu + logement + occupant + loyer en un geste, RPC
  `bulk_onboard_portfolio` avec lieu inline) ; écrans de création autonomes et
  server actions orphelines retirés. Audit sécurité isolation propriétaire
  (`landlord_id`) + test négatif cross-tenant produits en parallèle.

- Copie de la landing en voix propriétaire (v0.3.3.1, directive CEO) : accroche
  « Vous encaissez le loyer. Ranti édite la quittance, votre locataire la
  confirme. » (tirets cadratins retirés, formulations « générées » nettoyées) ;
  la légende sous le document convertit désormais — « La vôtre vous attend.
  Créer votre compte » mène à `/signup`, le document reste cliquable vers sa
  vérification.

- Landing minimale (v0.3.3.0, directive CEO) : la page d'accueil se réduit à
  un titre, une phrase, le CTA « Gérer vos loyers » — et le produit : la
  quittance elle-même, rendue depuis le vrai composant `ReceiptPdf` avec les
  données de `/verifier/demo` (n° RNT-2026-DEMO), filigranée « SPÉCIMEN —
  SANS VALEUR PROBANTE » (anti-contrefaçon hors-ligne, revue adversariale),
  cliquable vers sa vérification en ligne. Sections fonctionnement / preuve /
  tarif détaillé / FAQ retirées ; le tarif verrouillé reste en microcopie sous
  le CTA. Script de regénération `apps/web/scripts/generate-demo-quittance.tsx`.

- Split fiscal TVA (18 %) de la commission 5 % sur le ledger paiements
  (v0.3.2.0, ADR-018 v5). Chaque ligne archive `commission_ht` + `tva_amount`
  (= `service_fee`, taux archivé par ligne) : arrondi entier XOF, floor sur le
  HT, somme exacte par `CHECK`. Vision comptabilité invisible du propriétaire
  (grants colonne) — l'écran ne montre que le net et « 5 % tout inclus ».
  Fonctionnalité dormante (rail Kkiapay bloqué juridique BCEAO). Tests
  miroir TS/SQL, 239 vitest verts + suites SQL vertes.

- Offre affichée : « 3 mois gratuits à l'ouverture de votre registre, puis
  5 % sur chaque paiement de loyer réussi » (v0.3.1.2, directive CEO) — le
  framing « gratuit pendant le pilote » disparaît ; arrêt libre dit sans
  vocabulaire d'abonnement (« Vous arrêtez quand vous voulez », rien à
  résilier) ; nouvelle entrée FAQ « Combien ça coûte ? ».

- Tarif affiché comme unique (v0.3.1.1, directive CEO) : « 5 % sur chaque
  paiement de loyer réussi », FAQ sans optionnalité d'encaissement ;
  suppression des mentions « sans carte bancaire », « aucune carte demandée »
  et « pas de paiement encaissé, pas de commission » de la landing.

- Durcissement du ledger après review du ship v0.2.0.0 (migration
  `20260715070000`) : les replays de webhook divergents (même référence PSP
  mais montant ou bail différent) lèvent désormais `reference_conflict` au
  lieu d'être absorbés en silence — décision documentée dans ADR-018 ; GRANT
  SELECT explicite `service_role` sur `payment_transactions` (vision
  comptabilité) ; garde `service_bp > 10000` des deux côtés (SQL + TS) pour
  garder le miroir floor exact. Section frais v3 de l'ADR-018 retitrée
  « historique (supersédé par v4) ».
- Refonte de la landing en voix « vous » (v0.3.0.0, décision CEO 2026-07-14 —
  supersède la voix « je » du 2026-07-12 sur ce point) : héro recentré sur
  « Le registre de loyer des propriétaires africains », badge de confiance
  « Ranti ne détient jamais vos fonds » (exact dans les deux modes de
  paiement, aligné sur la FAQ), nouvelle section « Preuve » (quittance
  numérotée, confirmée par le locataire, vérifiable par lien public),
  fonctionnement resserré en trois étapes ; piliers et tableau comparatif
  retirés. Meta description alignée sur la même voix. Copie seule, aucune
  logique métier / DB touchée.
- Tarif rendu public sur la landing : section « Tarif » — 5 % tout compris
  (ADR-018 v4), uniquement sur les loyers encaissés via Ranti
  (100 000 F → 5 000 F de frais, 95 000 F reversés). Le paiement direct
  propriétaire ↔ locataire reste gratuit.
- Page de vérification de démonstration `/verifier/demo`, liée depuis la
  landing : entièrement statique (le segment statique a priorité sur la route
  dynamique `/verifier/[id]`, aucune requête base), numéro volontairement
  fictif `RNT-2026-DEMO`, badge « Exemple — sans valeur probante » — aucun
  faux verdict « Document authentique », qu'une vraie vérification est seule
  à afficher.

## Recent (2026-07-14)

- Modèle économique « All-Inclusive 5 % » (ADR-018 v4) : le propriétaire voit
  une commission unique de 5 % (net 95 %), les frais PSP deviennent des
  dépenses internes de Ranti — `net_margin` par transaction (≈ 2,35 % avec
  les coûts FeexPay retenus, taux archivés par ligne) pour suivre la
  rentabilité réelle en temps réel. Deux visions séparées EN BASE : grants
  par colonne (le propriétaire ne peut pas lire `net_margin`/`payin_cost` —
  permission denied testée). `calculateTransactionDetails` (TS) miroir de
  `compute_transaction_details` (SQL), migration `20260714230000`, suites
  SQL + vitest adaptées.

- Étude comparative PSP Bénin (ADR-018 v3) : Kkiapay vs FedaPay vs FeexPay sur
  le cycle cash-in → cash-out. **Reco : FedaPay** (payin MoMo 1,8 %, payout API
  vers MoMo d'un tiers **gratuit**, zéro abonnement, sandbox + webhooks +
  `merchant_reference` idempotente). Kkiapay disqualifié : pas de payout API
  standard (reversement manuel vers son propre compte) + 14 900 F/mois.
  FeexPay = repli (payin 1,7 % à la charge du locataire + payout 1 %). Split
  retenu : **1,8 % PSP + 1,2 % Ranti = 3,0 %** (défauts 180/120 bp, à
  verrouiller au contrat). Ledger repassé en deux composants
  (`psp_fee`/`platform_fee`), provider extensible
  (`fedapay`/`feexpay`/`kkiapay`). Architecture « Ranti = interface » : fonds
  dans le wallet marchand du PSP agréé, jamais chez Ranti.
- Cœur transactionnel PSP (ADR-018, révisé v2 le jour même) : ledger
  `payment_transactions` (montants FCFA entiers ; commission Ranti **3,0 %**
  configurable, `platform_fee_bp` stocké sur la ligne, floor + net par
  soustraction, CHECKs arithmétiques inviolables ; frais Kkiapay ~1,9 % payés
  par le locataire côté widget, hors système). Machine à états
  `pending → verified → paid_out` (+ `rejected` terminal). Le webhook signé
  HMAC `POST /api/payments/notification` **ingère seulement** ; `verified` =
  **validation du propriétaire** (RPC `verify_payment_transaction` accordée à
  authenticated avec garde d'appartenance) qui déclenche le pipeline existant
  record/confirm/quittance en une transaction ; `paid_out` = reversement
  effectué (ops, service_role). Domaine TS `src/lib/payments/`
  (`calculatePayout`, service, repository, action serveur de validation) +
  intégration isolée `src/lib/kkiapay/`. `recorded_by='psp'` ajouté. Pivot
  documenté : supersède partiellement ADR-009 ; ADR-017 pleinement respecté
  (validation humaine). ⚠️ **Non activé en prod avant validation juridique
  BCEAO** (détention transitoire de fonds — voir caveat ADR-018). 30 tests
  vitest + suite SQL (garde ownership, machine à états, idempotence, dédup
  cross-rail, assertions GRANTs) verts ; cycle complet vérifié E2E sur DB
  locale.

## Recent (2026-07-12)

- « Affecter » câblé + lien de confirmation dans le wa.me (PR #124). (1) Le
  bouton « Affecter » du journal était un placeholder mort ; il passe par la
  nouvelle RPC `allocate_reception` (migration 20260712040000, SECURITY INVOKER,
  anon révoqué) qui affecte après coup un encaissement Fast-Log confirmé mais
  non alloué à ses échéances — mêmes invariants que `record_collection_core`,
  aucune réception créée (pas de double comptage), écran
  `/collections/allocate/[id]`. (2) Le message WhatsApp au locataire ne portait
  AUCUN lien : `journal_feed` expose désormais `receipt_token` et le wa.me
  contient l'URL absolue `/recu/[token]` — le locataire confirme le reçu
  (deuxième voix ADR-013) et télécharge son PDF.
- Navigation en arbre « Baux » (PR #123). Top-nav réduit à 4 : Accueil ·
  Encaissements · Relances · Baux. « Baux » ouvre le drill-down Lieu
  (/properties) → Logement (/properties/[id]) → Locataire/bail (/units/[id]),
  quittances accessibles depuis chaque bail. Les listes plates restent des
  routes valides, retirées du top-nav.
- ADR-017 : lecture directe des SMS impossible en web/PWA → décision de recevoir
  les notifications de paiement côté serveur (webhook opérateur MTN/Moov/Wave/
  PI-SPI), dans le pipeline existant avec validation humaine ; collage SMS gardé
  en filet. Réception ≠ initiation (agrément BCEAO Tier 2 à confirmer).
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
