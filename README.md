# Ranti

Ranti est le registre de loyer actif des propriétaires africains.

## Statut

Vérifié le 2026-07-27 contre le code (v0.3.36.0), fichier par fichier. Toute ligne de cette section est vérifiable dans `apps/web/src` ou `supabase/migrations` ; en cas de doute, **le code fait foi et le README est faux**.

La boucle propriétaire est livrée de bout en bout : propriétés, logements, locataires, baux, génération des échéances, encaissements avec allocations, reçus/quittances, audit logs.

**Périmètre : loyer seul (ADR-026).** Les charges variables sont retirées depuis v0.3.34.0. Les objets DB des charges restent en base, inactifs.

**Relances — l'envoi est opéré à la main, hors de ce dépôt (ADR-022).** Il n'existe **aucun déclencheur d'envoi dans ce dépôt** : pas de route `/api/cron/reminders`, pas de `vercel.json`, pas de variable `REMINDERS_SMS_ENABLED`, aucun chemin SMS — tout cela a été supprimé par ADR-022. Le seul cron du système est côté Postgres (`pg_cron`, migration 011) et ne fait que passer les échéances `expected → overdue`.

Ce que ce dépôt porte réellement :

- la **cadence de référence** J-5 / J-1 / jour J / J+3 / J+10 (`lib/reminders/schedule.ts`), affichée sur le dashboard et la fiche bail ;
- la **relance manuelle préparée** : bouton « Relancer sur WhatsApp » ouvrant un lien `wa.me` pré-rempli (fiche bail, `/reminders`, journal, page reçu) — le propriétaire relit et envoie lui-même ;
- la **programmation** d'une relance ponctuelle (`scheduled_reminders`) que `ranti-ops` exécutera ;
- l'**affichage** des envois (`reminders` ∪ `reminder_events`) et le garde-fou de silence (`detectReminderSilence`, alerte au-delà de 2 jours sans envoi tracé sur une fenêtre passée).

L'envoi lui-même est fait en WhatsApp depuis le cockpit `ranti-ops` (dépôt séparé), par un opérateur. **C'est un geste humain, pas un automatisme** — alors que le dashboard et la landing disent « Ranti s'en charge automatiquement ». Écart assumé par ADR-022, à ne pas oublier.

**Surface locataire.** Le locataire n'a pas de compte. L'écran de déclaration de paiement `/confirmer/[token]` a été **retiré en v0.3.34.0** ; la colonne `rent_dues.confirmation_token` subsiste en base mais n'est plus lue. Restent : `/recu/[token]` (sa quittance, qu'il peut certifier ou contester) et `/verifier` (vérification publique).

**Rapport à l'argent — non-custodial (ADR-024, 2026-07-17).** « Ranti ne touche jamais l'argent » est la promesse en vigueur : le loyer circule directement du locataire au propriétaire (cash, Mobile Money, virement, alias PI-SPI d'ADR-009). La monétisation cible est l'abonnement par paliers (0 / 4 900 / 14 900 F, grille B-1). La commission transactionnelle de 5 % est abandonnée. ADR-024 supersède ADR-018 et ADR-019, et **neutralise le gate BCEAO pour le MVP** (sans détention de fonds, Ranti sort du champ de l'Instruction 001-01-2024).

Limites actuelles :

- **Rail custodial gelé mais toujours dans le code.** ~2 600 lignes (`lib/feexpay/`, `lib/payments/`, `lib/ledger/`, `app/api/payments/notification/`) et les tables `payment_transactions`, `transactions`, `ledger_notification_events` restent en place, typechecked et testées. Le webhook est câblé **FeexPay** (et non Kkiapay, disqualifié dès ADR-018 v3). Il n'est pas derrière un flag applicatif : il est **inerte par absence d'environnement** — sans `FEEXPAY_WEBHOOK_SECRET` la route répond 500 sans rien écrire. À flaguer explicitement ou à retirer.
- **Les paliers d'abonnement ne sont pas exécutables.** La grille B-1 est affichée sur la landing (`(public)/_components/landing.tsx`) ; il n'existe **ni colonne de plan, ni compteur de logements, ni facturation** en base ou dans `src/lib`. Le produit est intégralement gratuit et sans limite aujourd'hui.
- **Les réglages de relance ne sont pas honorés par la file d'envoi.** `landlords.reminders_enabled` / canal / moment sont persistés et lisibles, mais la file vit dans `ranti-ops` (ADR-022) et ne les lit pas : **couper le réglage n'arrête aucun envoi**. L'écran ne prétend plus le contraire — il parle de « préférence enregistrée » (correctif 2026-07-27), et l'échec d'écriture est désormais remonté à l'UI au lieu d'être avalé.
- **Saisie assistée retirée** (v0.3.5.2) : la saisie vocale Gemini (ADR-012) et le collage SMS Mobile Money (ADR-014) n'existent plus. Le **journal de bord** chronologique, lui, reste livré (`app/(app)/journal/`).

Variables d'environnement réellement lues par le code : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (client admin, utilisé par le seul webhook), `SUPABASE_JWT_SECRET`, les `FEEXPAY_*` (rail gelé), `NEXT_PUBLIC_AXEPTIO_CLIENT_ID`, `NEXT_PUBLIC_NOTION_HELP_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `RANTI_LOCAL_AUTH*` (dev seulement). **`CRON_SECRET` n'existe nulle part** dans le code.

Détail opérationnel : `docs/BUILD_STATUS.md`.

## Problème unique

Aider un propriétaire à savoir clairement :

1. qui a payé ;
2. qui est en retard ;
3. quelle preuve existe pour chaque paiement ;
4. quelle relance doit être préparée ou envoyée ;
5. quel reçu ou quelle quittance existe après validation.

## Boucle produit

Ranti suit une boucle simple :

1. le propriétaire renseigne le bail ;
2. Ranti génère les échéances ;
3. Ranti prépare ou automatise les rappels et relances ;
4. le propriétaire valide les paiements reçus ;
5. Ranti génère automatiquement le reçu ou la quittance adapté ;
6. Ranti conserve l'historique et les preuves.

## Deux moteurs produit

### Reminder Engine

Cible : à partir du bail et des échéances, Ranti prépare, planifie et envoie les rappels et relances, automatiquement.

Statut : **la cadence est calculée ici, l'envoi est humain et vit ailleurs (ADR-022).** Ce dépôt calcule les fenêtres (J-5 / J-1 / jour J / J+3 / J+10), prépare le message (`buildReminderMessage`), permet de programmer une relance ponctuelle, affiche les envois tracés et alerte en cas de silence. Il n'envoie rien : aucun déclencheur, aucun appel à un fournisseur de messagerie. `ranti-ops` envoie en WhatsApp, à la main. **L'automatisme reste une cible, pas un acquis** — et le nombre d'envois réels tracés se compte sur les doigts d'une main.

### Proof Engine

À partir d'un paiement validé par le propriétaire, Ranti génère automatiquement le document adapté : reçu partiel, reçu complet ou quittance.

Statut : implémenté (`generate_receipt`, `receipts.kind`, `snapshot`, numérotation atomique, correction par remplacement). Aucun document n'est généré sans allocation financière réelle.

## État livré

Livré :

- auth propriétaire ;
- profil propriétaire ;
- propriétés ;
- logements ;
- locataires ;
- baux ;
- activation / fin de bail ;
- génération des échéances ;
- encaissements ;
- allocations aux échéances ;
- reçus/quittances ;
- audit logs ;
- RLS activé ;
- verrou d'identité propriétaire (ADR-002, live 2026-07-16) ;
- dashboard mensuel de synthèse, en lecture seule (ADR-020) ;
- onboarding bail-centric — créer un bail est l'entrée de création unique (ADR-020) ;
- journal de bord chronologique (`app/(app)/journal/`) ;
- modification et archivage des propriétés, logements, locataires et baux (pages `/[id]/edit` + actions `updateX` / `archiveX`) ;
- relance **préparée** : cadence de référence, message pré-rempli `wa.me`, programmation d'une relance ponctuelle, affichage des envois et détection de silence — l'envoi lui-même est opéré par `ranti-ops`, voir « Statut » ;
- surface locataire sans compte : quittance `/recu/[token]` avec certification et contestation ;
- empreinte d'intégrité SHA-256 **scellée à l'émission** (migrations `20260727120000` + `20260727120010`, **appliquées en prod le 2026-07-27**) : une quittance neuve est vérifiable sans attendre un geste du locataire. Après application : 6 reçus actifs, 0 non scellé, 5 `verified`, 1 `cancelled`, 0 `tampered` — verdicts strictement identiques à l'état d'avant migration. Recette unique (`private.receipt_computed_fingerprint`) partagée par l'émission, la certification et les deux chemins de vérification. La certification locataire reste la deuxième voix (ADR-013) et ne réécrit pas le sceau. Portée : opposable au tiers, pas à l'éditeur — SHA-256 sans secret, stockée dans la table qu'elle protège ;
- levée d'ambiguïté des références RNT : quand deux bailleurs portent le même numéro, `/verifier` demande le nom du propriétaire (filtre d'entrée, jamais affiché) ;
- reprise de la prise en main : `/first-run` est reconstitué depuis la base (`leases.created_during_onboarding`), un rechargement ne fait plus créer de bail en double ;
- vérification publique des quittances : par lien/QR (`/verifier/[id]`) et, depuis v0.3.36.0, par référence `RNT-AAAA-NNNN` (`/verifier`, RPC `verify_receipt_by_number` — chemin énumérable donc volontairement pauvre : ni nom, ni logement, ni montant, ni empreinte) ; exemple statique `/verifier/demo` ;
- prise en main guidée FirstRun : rail « Premiers pas » sur le tableau de bord (v0.3.28.0) et parcours `/first-run` câblé à la base (bail, paiement et quittance réels, statut `landlords.onboarding_status` ; v0.3.29.0, voir `docs/welcome-flow.md`) ;
- réglages de relance par bailleur persistés (`reminders_enabled`, canal, moment), avec échec d'écriture remonté à l'UI et retour à l'état précédent : persistance seule, la file de relance ne les applique pas encore ;
- référence de quittance `RNT-AAAA-NNNN` (séquence annuelle par bailleur) et clause notariale avec montant en toutes lettres, identiques sur les 4 surfaces (page publique, PDF, page bailleur, modale FirstRun) ;
- moyen de paiement (Espèces / Mobile Money / Virement) et date de réception sur la quittance partagée au locataire (page `/recu/[token]` + PDF, usage du bail d'habitation Loi n° 2022-30 ; libellés centralisés dans `lib/receipts/labels.ts`) ;
- pages légales enrichies (CGU, confidentialité ; éditeur WI'SOFT SOLUTIONS) et page publique « À propos » (`/a-propos`) — depuis v0.3.36.0 la raison sociale vit là, le pied de page landing (colonnes Produit / Ressources / Entreprise) reste léger ;
- système de design (`DESIGN.md`) appliqué aux écrans ; palette claire seule depuis v0.3.29.0 (pas de mode sombre, `design_handoff_first_run/` fait foi).

À compléter :

- **validation terrain** : ADR-024 §5 conditionne tout nouveau développement produit à **5 entretiens de bailleurs diaspora / à distance** consignés au research-log. `docs/research-log.md` en compte **un** (2026-07-17), plus une entrée OSINT. La règle n'est pas tenue ;
- **faire honorer les réglages de relance par la file d'envoi** (`ranti-ops`, dépôt séparé) : les colonnes `reminders_enabled` / canal / moment sont écrites et affichées honnêtement depuis le 2026-07-27, mais la file ne les lit toujours pas. Tant que c'est le cas, l'écran parle de « préférence enregistrée », jamais d'un interrupteur d'envoi ;
- **trancher le sort du rail gelé** : le flaguer explicitement ou le retirer du dépôt (ADR-024 disait « derrière un flag désactivé » ; c'est aujourd'hui de l'inertie d'environnement) ;
- **implémenter les paliers** (plan, comptage des logements, encaissement de l'abonnement — FedaPay pressenti) si la grille B-1 doit exister autrement que sur la landing. Note : `vision.md` et ADR-024 renvoient à `docs/comparatif-psp`, **qui n'existe pas dans le dépôt** ;
- **aligner les versions de migration dépôt ↔ prod.** Les migrations sont appliquées via l'API, qui horodate elle-même : `supabase_migrations.schema_migrations` en prod porte `20260727152507`, le dépôt `20260727120000`. Les noms concordent, les versions non — `supabase db push` n'est donc pas utilisable en l'état ;
- E2E authentifié **par le navigateur** : l'auth Google seule (ADR-010) empêche tout login automatisé, donc aucun test ne traverse l'UI connectée. Côté base, la boucle argent est en revanche couverte : `supabase/tests/` rejoue `record → confirm → generate_receipt` sous le rôle `authenticated`, et la CI passe la suite à chaque PR (job `db`) ;
- WhatsApp **automatique dans l'app** — la relance manuelle `wa.me` est livrée, l'envoi programmé reste chez `ranti-ops` ;
- ops runbook complet (`docs/ops-deployment.md` existe, incomplet).

Suivi détaillé et priorités : `TODOS.md`.

## Sources de vérité

Produit :

```txt
docs/vision.md
docs/principes.md
docs/personas.md
docs/user-flows.md
docs/research-log.md
```

Domaine et architecture :

```txt
docs/domain-model.md
docs/database.md
docs/api.md
docs/architecture.md
docs/decisions/
```

Implémentation et ops :

```txt
docs/roadmap.md
docs/implementation-plan-reminder-proof-engines.md
docs/gap-analysis-live-db-reminder-proof-engines.md
docs/ops-deployment.md
docs/docs-sync.md
```

Design :

```txt
docs/design-brief.md
docs/design/
```

## Règle de construction

Aucune fonctionnalité n'entre dans Ranti si elle ne rend pas plus simple le fait de savoir qui a payé, qui doit payer, quelle relance doit partir, ou quelle preuve doit exister après validation d'un paiement.
