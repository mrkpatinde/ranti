# Ranti

Ranti est le registre de loyer actif des propriétaires africains.

## Statut

Vérifié le 2026-07-17 contre le code (v0.3.5.2) ; complété le 2026-07-18 (v0.3.29.0 : prise en main FirstRun, référence RNT, note ADR-024) ; complété le 2026-07-24 (v0.3.36.0 : vérification par référence, moyen de paiement sur la quittance, landing tarifs B-1).

La boucle propriétaire est livrée de bout en bout : propriétés, logements, locataires, baux, génération des échéances, encaissements avec allocations, reçus/quittances, audit logs.

**Relances — semi-automatiques, pas automatiques.** Les échéances et les gabarits existent ; le déclencheur, non. Le cron `/api/cron/reminders` (planifié par `apps/web/vercel.json`) est **dormant par défaut** : il ne fait rien tant que `REMINDERS_SMS_ENABLED` n'est pas défini (`1`/`true`), et cette variable n'est pas activée. Le canal de relance **de fait est WhatsApp**, envoyé depuis le cockpit ops `ranti-ops` — un geste opérateur, pas un automatisme. La dormance est délibérée : sans cross-dedup entre le cron et `reminder_events`, activer le SMS enverrait une double relance (SMS + WhatsApp) sur la même échéance.

Confirmation locataire par lien public à token (`/confirmer/[token]`) : livrée. Le locataire ne crée pas de compte — il déclare avoir payé, le propriétaire valide.

**Mise à jour (ADR-024, 2026-07-17) : retour non-custodial.** La commission transactionnelle de 5 % est abandonnée ; le modèle est l'abonnement par paliers (gratuit pour un logement) et « Ranti ne touche jamais l'argent » redevient la promesse publique. Le rail custodial FeexPay (ADR-019) est gelé. Le paragraphe ci-dessous décrit l'épisode ADR-019 et est conservé comme trace.

**Rapport à l'argent — la promesse a changé (ADR-019, 2026-07-15).** « Ranti ne détient jamais les fonds » est **abandonné** comme cible produit. Le rail **FeexPay** est désormais le chemin d'encaissement **unique et obligatoire** : le locataire paie 100 % du loyer sans surcharge, les fonds transitent par le wallet marchand FeexPay **au nom de Ranti**, 5 % TTC sont prélevés sur le brut et 95 % reversés au propriétaire.

Rien de tout cela n'est actif en production : le **gate juridique BCEAO** (détention transitoire → qualification possible en établissement de paiement, Instruction 001-01-2024) n'est pas levé. Tant qu'il tient, l'argent circule hors Ranti (cash, Mobile Money, virement), le propriétaire valide les paiements reçus, et l'alias PI-SPI (ADR-009) sert de filet.

Limites actuelles :

- **Écart décision ↔ code sur le rail.** ADR-019 décide FeexPay ; le webhook implémenté est **Kkiapay** (`app/api/payments/notification/route.ts`, signature `x-kkiapay-signature`, `provider: "kkiapay"` en dur). FeexPay n'existe qu'en membre du type `PaymentProvider`, en taux par défaut dans `lib/payments/fees.ts`, et en commentaires. Le gate BCEAO masque l'écart — rien n'étant activé, personne ne le heurte. À résorber avant toute mise en production du rail.
- **Envoi SMS réel non activé** : prérequis = cross-dedup cron ↔ `reminder_events`, clés provider en prod, puis `REMINDERS_SMS_ENABLED=1`. En sandbox les SMS sont seulement journalisés.
- `CRON_SECRET` et `SUPABASE_SECRET_KEY` doivent être définis dans Vercel avant que la relance tourne.
- **Saisie assistée retirée** (v0.3.5.2) : la saisie vocale Gemini (ADR-012) et le collage SMS Mobile Money (ADR-014) n'existent plus. Le **journal de bord** chronologique, lui, reste livré (`app/(app)/journal/`).

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

Statut : **codé, pas armé.** Les briques existent (cron `/api/cron/reminders`, fenêtres J-5/J-1/retard, table `reminders`, confirmation locataire par token) mais le cron est dormant (`REMINDERS_SMS_ENABLED` non défini). Aujourd'hui la relance part à la main en WhatsApp depuis `ranti-ops`. L'automatisme reste une cible, pas un acquis.

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
- briques de relance (cron + gabarits SMS) — **dormantes**, voir « Statut » ;
- confirmation locataire par lien public ;
- vérification publique des quittances : par lien/QR (`/verifier/[id]`) et, depuis v0.3.36.0, par référence `RNT-AAAA-NNNN` (`/verifier`, RPC `verify_receipt_by_number` — chemin énumérable donc volontairement pauvre : ni nom, ni logement, ni montant, ni empreinte) ; exemple statique `/verifier/demo` ;
- prise en main guidée FirstRun : rail « Premiers pas » sur le tableau de bord (v0.3.28.0) et parcours `/first-run` câblé à la base (bail, paiement et quittance réels, statut `landlords.onboarding_status` ; v0.3.29.0, voir `docs/welcome-flow.md`) ;
- réglages de relance par bailleur persistés (`reminders_enabled`, canal, moment) : persistance seule, la file de relance ne les applique pas encore ;
- référence de quittance `RNT-AAAA-NNNN` (séquence annuelle par bailleur) et clause notariale avec montant en toutes lettres, identiques sur les 4 surfaces (page publique, PDF, page bailleur, modale FirstRun) ;
- moyen de paiement (Espèces / Mobile Money / Virement) et date de réception sur la quittance partagée au locataire (page `/recu/[token]` + PDF, usage du bail d'habitation Loi n° 2022-30 ; libellés centralisés dans `lib/receipts/labels.ts`) ;
- pages légales enrichies (CGU, confidentialité ; éditeur WI'SOFT SOLUTIONS) et page publique « À propos » (`/a-propos`) — depuis v0.3.36.0 la raison sociale vit là, le pied de page landing (colonnes Produit / Ressources / Entreprise) reste léger ;
- système de design (`DESIGN.md`) appliqué aux écrans ; palette claire seule depuis v0.3.29.0 (pas de mode sombre, `design_handoff_first_run/` fait foi).

À compléter :

- **aligner le code du rail sur ADR-019** (webhook Kkiapay → FeexPay) ;
- **lever le gate BCEAO** avant toute activation du rail en production ;
- cross-dedup cron ↔ `reminder_events`, puis activation du SMS réel ;
- WhatsApp **dans l'app** (colonne `channel` prévue, non implémentée) — à distinguer du WhatsApp ops, lui déjà en usage via `ranti-ops` ;
- modifier / archiver propriétés, logements et locataires côté UI ;
- trancher le « pont de capture » : garder `/collections/new` comme filet manuel tant que le rail n'est pas live (question ouverte, ADR-019) ;
- ops runbook complet ;
- validation terrain documentée.

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
