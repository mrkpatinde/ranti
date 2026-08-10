# Ranti — Build Status

Dernière mise à jour : 2026-08-09 (pivot entreprises de gestion, ADR-029 ;
retrait du rail de paiement, ADR-030).

> L'état courant est en **section 0**. La section **0 bis** (état au
> 2026-07-17) et les sections **1 à 3 bis** (état au 2026-07-03) sont
> conservées comme trace historique : leurs constats sur le rail de paiement,
> le cron SMS et le parcours `/first-run` ne valent plus. Les sections 5 à 10
> décrivent la procédure et l'état courants.

## 0. État courant (2026-08-09)

### Le pivot (ADR-029)

Le client de Ranti est l'entreprise de gestion immobilière. Le compte connecté
est l'agence ; elle gère des lots pour des propriétaires mandants qui ne sont
pas des utilisateurs et reçoivent un relevé mensuel. Le wedge est la clôture
mensuelle du portefeuille.

Quatre briques livrées :

| Brique | Migration | Base | Application |
| :-- | :-- | :-- | :-- |
| Import de portefeuille par fichier | `20260809120600` | `validate_portfolio_import`, `import_portfolio`, index d'unicité sur `properties(landlord_id, name)` | `/import`, `src/lib/import/` |
| Propriétaires mandants | `20260809120500` | `owners`, `properties.owner_id`, RLS et triggers conventionnels | `/owners`, `src/lib/owners/` |
| Relevé mensuel et clôture | `20260809120700` | `owner_statement`, `owner_statement_lines`, vue `owner_month_summary` | `/cloture`, `/cloture/[ownerId]`, PDF, `src/lib/statements/` |
| Relances par lot | `20260809120800` | vue `reminder_batch`, `log_reminder_batch`, policy d'insert sur `reminder_events` | `/reminders/batch`, `src/lib/reminders/batch.ts` |

Navigation étendue dans `src/components/app-shell.tsx` : `/cloture` rejoint la
barre principale, `/owners` et `/import` la navigation secondaire.

### Les cinq corrections de socle

| Migration | Objet |
| :-- | :-- |
| `20260809120000` | Retrait du rail de paiement (ADR-030) : tables `payment_transactions` et `payment_proofs`, quatre RPC du rail, avec balayage des surcharges résiduelles. Côté application : `src/lib/feexpay/`, `src/lib/payments/`, `src/app/api/payments/` supprimés. |
| `20260809120100` | Retrait des charges variables restées en SQL après ADR-026, de `ledger_notification_events` et de 14 fonctions sans appelant applicatif. |
| `20260809120200` | Réparation d'une dérive base ↔ migrations : RLS jamais activée par migration sur `reminders` et `reminder_events` (policies inertes sur une base reconstruite depuis le dépôt) ; `receipts` accordant `DELETE`, `TRUNCATE`, `REFERENCES` et `TRIGGER` à `authenticated` en production. Vue de contrôle `public.ops_grant_drift`. |
| `20260809120300` | Durcissement du sceau de quittance : HMAC sous secret serveur (`private.app_secrets`), trigger interdisant l'écriture cliente des colonnes de certification, jeton locataire délivré par la RPC journalisée `receipt_share_token`. |
| `20260809120400` | Contrôle quotidien de l'égalité entre `rent_dues` et `transactions` (`private.ledger_health`, vue `public.ops_ledger_health`, tâche pg_cron `ranti-ledger-health` à 03h10 UTC). |

### Le parcours dupliqué supprimé

`src/app/first-run/` est retiré. Le rail « Premiers pas » du tableau de bord
reste le seul chemin de prise en main.

### Intégration continue

`.github/workflows/ci.yml` exécute deux jobs : `web` (lint, tests unitaires,
build) et `sql` (rejeu de toutes les migrations puis de la suite de tests
`supabase/tests/` sur un Postgres 16). La suite SQL n'était jusqu'ici jouée
qu'à la main.

### Écarts ouverts

1. **Phase « contract » du grand livre jamais faite.** `rent_dues` et
   `transactions` coexistent depuis la migration `20260716150000` ; le tableau
   de bord interroge les deux sur la même page. La divergence est désormais
   mesurée chaque jour, elle n'est pas résolue.
2. **Un compte reste un portefeuille.** Le partage entre plusieurs employés
   d'une agence n'existe pas (ADR-029, remis à plus tard).
3. **Limite connue du sceau de quittance.** Un gestionnaire déterminé peut
   récupérer le lien de certification et cliquer à la place de son locataire.
   Le sceau prouve l'intégrité du document et le passage par le parcours à
   jeton, pas l'identité du cliqueur (ADR-013 §4). La délivrance du lien est
   journalisée.
4. **Vestiges d'énumération du rail supprimé** : `rent_receptions.recorded_by`
   accepte encore `'psp'`, `transactions.source` encore `'feexpay'`. Aucun
   écrivain.
5. **Collision de numéro ADR-006** (relances / audit) — non renumérotée, des
   commentaires `.sql` référencent les deux.
6. **Relances : Ranti n'envoie rien.** Le message part du WhatsApp du
   gestionnaire par lien `wa.me`. Le produit fournit la file, le message
   pré-rédigé et la trace.

---

## 0 bis. État au 2026-07-17 (v0.3.5.2) — trace historique

Mesuré, pas supposé :

- **Tests unitaires : 239 passés, 25 skippés (264 total), 25 fichiers.** Les 25
  skippés sont les tests d'intégration/charge, ignorés faute de dev server sur
  `http://localhost:3300`.
- Les chiffres « 117/117 » (§1) et « 86 tests » (§7) sont **périmés** — ils se
  contredisaient déjà entre eux.

Livré depuis le 2026-07-03 (non couvert par les sections ci-dessous) :

| Version | Apport |
|---|---|
| v0.3.1.x–v0.3.2.x | `DESIGN.md` (système de design), landing minimale, offre « 3 mois gratuits puis 5 % », split fiscal TVA du ledger |
| v0.3.4.0 | Onboarding bail-centric + dashboard lecture seule (ADR-020) |
| v0.3.4.1–v0.3.4.7 | Nav mobile, profil unifié, composition desktop éditoriale, contraste |
| v0.3.5.0 | **Verrou d'identité propriétaire (ADR-002)** — live 2026-07-16 |
| v0.3.5.1 | Grants `private *_core` — le repo rejoint la prod |
| v0.3.5.2 | **Retrait de la saisie assistée** : vocal Gemini (ADR-012) + collage SMS (ADR-014) supprimés |
| v0.3.6.x–v0.3.25.x | Voir `CHANGELOG.md` (grand livre ADR-023, PWA hors connexion, optimistic UI, etc.) |
| v0.3.26.0 | Prise en main guidée (prototype FirstRun de bout en bout), `direction-artistique.html`, moindre privilège `anon` |
| v0.3.27.0 | Nouvelle landing DA, consentement Axeptio, **tarif ADR-024** (abonnement par paliers, « 5 % » banni des surfaces publiques, rail custodial gelé) |
| v0.3.28.0 | Rail guidé « Premiers pas » branché sur le tableau de bord + centre d'aide (FirstRun) |
| v0.3.29.0 | **FirstRun câblé à la base** (`/first-run` : bail, paiement, quittance réels), colonnes de relance bailleur + référence `RNT-AAAA-NNNN` (prod), clause notariale + montant en toutes lettres, mode sombre supprimé, CGU/confidentialité éditeur WI'SOFT SOLUTIONS |
| v0.3.30.0–v0.3.32.0 | Voir `CHANGELOG.md` : consentement à la quittance électronique, programmation de relances (« Programmer » / « Relancer maintenant »), relances des charges validées, présentation Ranti au premier message, retrait du rail de paiement des écrans |
| v0.3.33.0 | **Navigation quasi instantanée** : streaming Suspense + squelettes au gabarit de chaque écran, cache client 30 s (`staleTimes`) purgé par `revalidateMoneySurfaces` (`lib/cache/money.ts`) sur les écritures d'argent, session validée localement dans le proxy (`getClaims` ; plus d'appel Auth systématique par navigation, repli `getUser` sur jeton legacy HS256), lectures dédupliquées par render (React `cache()`), annulation optimiste d'une relance programmée |
| v0.3.34.0 | **Ranti rent-only** (retrait des charges variables, ADR-026 ; objets DB dormants) ; **quittance conforme au bail d'habitation** (Loi 2022-30 art. 67, adresse bailleur, ADR-027) ; **refonte minimaliste** (chiffre héro, boutons ronds, barre d'onglets mobile, réglages) ; preuve en avant à la prise en main. Migrations `20260722120000` + `20260719120000` + `20260719130000` à appliquer au déploiement |
| v0.3.35.0 | **Adresse canonique du site déclarée** : apex `monranti.com` (`metadataBase` + `alternates.canonical`), `sitemap.xml` et `robots.txt` ; quittances (`/recu/`) et vérifications réelles (`/verifier/<id>`) hors indexation, `/verifier/demo` conservée. **Contrat de purge corrigé** : `revalidateMoneySurfaces` applique un `revalidatePath("/", "layout")` unique (seul levier qui purge le cache CLIENT), `updateLease` rattaché au contrat, appels par chemin redondants retirés. Aucune migration |
| v0.3.36.0 | **Landing Moneco + tarifs B-1 annuel d'abord** (équivalent euro diaspora, footer colonnes, page `/a-propos`) ; **vérification publique par référence** (`/verifier`, RPC `verify_receipt_by_number` durcie : verdict côté SQL, ni nom ni montant ni empreinte sur ce chemin énumérable) ; **moyen de paiement sur la quittance partagée** (page `/recu/[token]` + PDF, Loi 2022-30) ; `/verifier` exclu du cache PWA (fail closed), dates de preuve stables tous fuseaux. Migrations `20260724100000`/`101000`/`140000` **appliquées en prod** |

Écarts ouverts au 2026-07-17, et leur sort :

1. **Rail de paiement : décision ≠ code.** ADR-019 décidait FeexPay comme
   cash-in unique ; le webhook implémenté était Kkiapay. *Clos le 2026-08-09
   par suppression du rail (ADR-030).*
2. **Gate BCEAO non levé.** *Clos le 2026-08-09 : sans détention de fonds,
   Ranti sort du champ de l'Instruction 001-01-2024.*
3. **Relances toujours dormantes** — canal de fait WhatsApp. *Toujours vrai :
   Ranti n'envoie rien lui-même. Le geste est passé de « bail par bail » à
   « le portefeuille en une passe » (`/reminders/batch`).*
4. **Vestige ADR-014** : `collections/allocate/[id]/page.tsx` cite « Fast-Log
   (collage SMS) » alors que la capture SMS n'existe plus. *À vérifier.*
5. **Collision de numéro ADR-006** (relances / audit) — non renumérotée, des
   commentaires `.sql` référencent les deux. *Toujours vrai.*

---

## Historique — état au 2026-07-03 (corrections P0/P1 post-review)

> ⚠️ Note 2026-07-16 : les sections sur le cron SMS `/api/cron/reminders`
> (`CRON_SECRET`, `REMINDERS_SMS_ENABLED`, Africa's Talking) sont OBSOLÈTES —
> le chemin SMS a été supprimé et l'envoi des relances est opéré par ranti-ops
> (WhatsApp). Voir ADR-022.

## 1. Ce qui a été trouvé

Le produit est cohérent avec la vision : registre de loyer pour propriétaires,
français d'abord, mobile d'abord. La boucle cœur est implémentée de bout en
bout (UI + DB + RLS) :

propriété → logement → locataire → bail → échéances → encaissement →
quittance PDF → relance SMS → confirmation locataire.

- Build Next.js : OK. Tests unitaires : 117/117. Lint : 0 erreur.
  *(Périmé — voir §0 : 239 passés / 25 skippés au 2026-07-17.)*
- Docs (vision, ADR-001 à 006, roadmap) alignées avec le code.
  *(Périmé — la dérive constatée le 2026-07-17 a motivé la présente passe.)*
- RLS multi-propriétaire uniforme via `private.current_landlord_id()`.
- Invariants financiers (branche `stabilize/p0-invariants`) : échéances non
  réécrivables si liées à un paiement, correction de quittance par
  remplacement (jamais de suppression), audit transactionnel fail-closed.

## 2. Incohérences détectées (et corrigées le 2026-07-02)

1. **Relances mortes en production (P0).** Le cron `/api/cron/reminders` et la
   page publique `/confirmer/[token]` utilisaient le client Supabase
   anonyme/cookies. Sans session, RLS renvoyait zéro ligne : le cron
   n'envoyait jamais rien, la page locataire affichait toujours « introuvable ».
2. **Aucun déclencheur cron.** Pas de `vercel.json` → la route relance n'était
   jamais appelée.
3. **Fenêtres de relance fausses.** Un loyer en retard de 1–2 jours recevait le
   SMS « dû demain » (`j-1`).
4. **Message j+3/j+10 :** recevait la date d'échéance au lieu du mois concerné.
5. **Dérive migrations.** Le schéma reminders existait en live sans migration
   versionnée (018 non enregistrée) ; les 3 migrations de la branche
   stabilize n'étaient pas appliquées en live.
6. **Test unitaire périmé** sur `normalizeTenantPhone` (le code normalise
   désormais en E.164 `+229…`, conforme ADR-003).
7. Lint : 5 apostrophes non échappées dans le JSX.

## 3. Corrections apportées

- `supabase/migrations/20260702090000_tenant_confirmation_rpc.sql` : deux
  fonctions `SECURITY DEFINER` clés sur le token UUID
  (`get_rent_due_by_token`, `declare_rent_payment_by_token`). L'anon n'accède
  plus à aucune table ; exposition limitée aux champs affichés. Page et action
  `/confirmer/[token]` réécrites pour utiliser ces RPC.
- `apps/web/src/lib/supabase/admin.ts` : client service-role serveur
  uniquement (`SUPABASE_SECRET_KEY`), utilisé par le cron. Le cron renvoie
  une 500 explicite si la clé manque.
- `apps/web/vercel.json` : cron quotidien 08:00 UTC (09:00 Bénin) sur `/api/cron/reminders`.
- Fenêtres de relance corrigées dans `sms.ts` : J-5→J-2 = `j-5`, J-1/J-0 =
  `j-1`, retard = `j+3`, retard ≥ 10 j = `j+10` (copy « en retard » sans durée).
- Live Supabase resynchronisé : migrations `reminders`, `rent_due_invariants`,
  `receipt_correction_flows`, `sensitive_mutation_audit`,
  `tenant_confirmation_rpc` appliquées et enregistrées.
- Test téléphone locataire mis à jour (E.164), apostrophes JSX corrigées.

## 3 bis. Corrections P0/P1 du 2026-07-03 (PR dédiées)

- Déclaration locataire : crée désormais réception draft + allocation vers
  l'échéance exacte du token (migration `20260703010000`). Plus de
  confirmation sans réduction de dette ni quittance `allocations: []`.
- `confirm_collection` : re-contrôle transactionnel du reste dû au moment
  de confirmer (migration `20260703020000`) — deux brouillons concurrents
  ne peuvent plus dépasser `amount_due`.
- Dashboard : « Encaissé ce mois » = allocations des réceptions confirmées
  reçues dans le mois (plus de somme historique globale).
- Mode local : `RANTI_LOCAL_AUTH=1` et `=true` acceptés, jamais en prod.

## 4. Ce qui reste incomplet — état au 2026-07-05, trace historique

> Les trois premières puces décrivent le cron SMS `/api/cron/reminders`,
> supprimé depuis (ADR-022). Le reste de la section vaut toujours.

- **Canal de relance de fait = WhatsApp (cockpit ranti-ops).** Le cron SMS
  `/api/cron/reminders` est **dormant par défaut** : il ne fait rien tant que
  `REMINDERS_SMS_ENABLED` (`1`/`true`) n'est pas défini. Raison : sans
  coordination avec les envois ops (`reminder_events`), activer le SMS
  provoquait une double relance (SMS + WhatsApp) sur la même échéance, et le
  mode sandbox enregistrait des lignes « envoyée » fantômes. Voir M1 (revue
  2026-07-05).
- **Envoi SMS réel** : quand on voudra le SMS, prérequis = (1) cross-dedup
  cron ↔ `reminder_events`, (2) `AT_API_KEY`/`AT_USERNAME` prod, (3)
  `REMINDERS_SMS_ENABLED=1`. Aujourd'hui non activé.
- **`CRON_SECRET` et `SUPABASE_SECRET_KEY`** à définir dans Vercel avant que
  la relance tourne réellement.
- **Auth Google-only (temporaire, 2026-07-05)** : connexion et inscription
  passent uniquement par Google, quel que soit le pays de l'utilisateur. Les
  parcours téléphone/mot de passe/OTP/récupération sont **gelés** — le code
  reste dans `lib/auth/actions.ts`, `validation.ts` et les composants
  `phone-field`/`password-field`, mais aucune page ne les expose (`/recover`
  et `/signup/verify` redirigent). Le gate pays d'inscription est retiré.
  Dégel = re-brancher les formulaires + réactiver le provider Phone Supabase.
  Note : la contrainte « numéro béninois obligatoire » à l'onboarding est
  levée (ADR-011) — sélecteur d'indicatif Bénin/Sénégal/Côte d'Ivoire, numéro
  validé contre le plan du pays via le registre `countries.ts`. Un pays hors
  registre (ex. Togo) reste bloqué tant que son plan n'y est pas ajouté.
- **Mode local** : `RANTI_LOCAL_AUTH` reste disponible pour développer sans
  OAuth.
- UI modifier/archiver manquante pour certains objets (logique métier prête).
- WhatsApp : canal prévu (colonne `channel`), non implémenté — SMS d'abord.
- Deux warnings advisor Supabase sur les RPC token : **intentionnel**
  (page locataire publique, token UUID non devinable). Warning « leaked
  password protection » : à activer dans le dashboard Auth.

## 5. Lancer le projet en local

```bash
cd apps/web
bun install
bun run dev        # http://localhost:3000
```

`.env.local` requis (état au 2026-08-09) :

```txt
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
RANTI_LOCAL_AUTH=1              # bypass auth en dev
RANTI_LOCAL_AUTH_USER_ID=…      # id auth.users du compte seed
RANTI_LOCAL_AUTH_PHONE=…
SUPABASE_SECRET_KEY=…           # serveur uniquement, jamais côté client
```

Optionnelles : `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_AXEPTIO_CLIENT_ID`,
`NEXT_PUBLIC_NOTION_HELP_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`,
`NEXT_PUBLIC_SUPPORT_WHATSAPP`.

`CRON_SECRET` n'a plus d'usage : le cron SMS a été supprimé (ADR-022). Les
variables `FEEXPAY_*` non plus : le rail de paiement est supprimé (ADR-030).

## 6. Migrations Supabase

```bash
supabase login
supabase link --project-ref pcxkxeesgusorrpmrkaj
supabase db reset   # rejoue toutes les migrations + seed.sql
```

Les migrations `20260809*` et `20260810*` (pivot ADR-029, corrections de socle,
raison sociale, correctif du parcours jeton) sont à appliquer au déploiement. Contrôles après application : `public.ops_grant_drift`
doit être vide, et la dernière ligne de `public.ops_ledger_health` doit porter
`healthy = true`.

Règle : toute migration appliquée en live — y compris depuis ranti-ops —
doit avoir son fichier versionné ici, avec le même timestamp que la version
live. La migration `20260809120200` a été écrite après le constat inverse :
deux modifications appliquées hors migration avaient laissé la production et le
dépôt dans des états différents, dont l'un ouvrait les relances de tous les
portefeuilles à tout compte authentifié sur une base reconstruite. Les migrations ops (`create_ops_reminders`, `ops_dashboard_views`)
sont rapatriées ; leurs objets sont réservés service_role (aucun grant
anon/authenticated).

## 7. Tester le flux principal

```bash
cd apps/web
bun run test         # vitest
bun run lint
bun run build
bun run test:e2e     # Playwright (nécessite RANTI_LOCAL_AUTH)
```

Tests SQL (rejeu des migrations puis de `supabase/tests/` sur un Postgres 16) :
exécutés par le job `sql` de `.github/workflows/ci.yml`, qui est la référence
de la procédure locale.

Parcours à vérifier à la main après une migration :

- `/import` — validation d'un fichier fautif, puis import complet ;
- `/cloture` puis `/cloture/<ownerId>` et son PDF — les totaux doivent être la
  somme des lignes ;
- `/reminders/batch` — sélection, message pré-rédigé, trace enregistrée ;
- `/recu/<token>` — certification locataire, puis `/verifier/<id>`.

## 8. Script de démo (rendez-vous agence)

Préparation : un compte avec au moins deux mandants, une dizaine de lots, des
encaissements du mois en cours et au moins une échéance en retard.

1. **L'import.** Ouvrir `/import` avec le fichier Excel de l'agence.
   Montrer l'aperçu ligne par ligne, corriger une erreur, relancer, importer.
   « Votre portefeuille entre en une fois. »
2. **Le tableau de bord.** En retard, attendu, encaissé.
3. **La relance par lot.** `/reminders/batch` : tous les retards du mois,
   message pré-rédigé, envoi depuis le WhatsApp du gestionnaire, trace
   enregistrée. « Soixante lots, une passe. »
4. **L'encaissement et la quittance.** Enregistrer un versement, l'allouer,
   ouvrir le PDF : numéro unique, périodes réglées, montant en toutes lettres.
5. **La clôture.** `/cloture` : par mandant, encaissé, honoraires, net à
   reverser. Ouvrir un relevé, montrer le détail lot par lot et le PDF.
   « Ce que vous mettez trois jours à faire. »
6. **La vérification.** Ouvrir `/verifier/<id>` : le document se vérifie hors
   de l'application.

Plan B si réseau instable : captures d'écran du parcours prises à l'avance.

## 9. Risques connus

- `generate_rent_dues` génère jusqu'au mois courant : une démo un 1er du mois
  montre peu d'échéances — préparer les données la veille.
- Un import de démonstration écrit dans le portefeuille : utiliser un compte
  dédié, l'opération est idempotente mais pas annulable.
- Mode local auth (`RANTI_LOCAL_AUTH`) ne doit jamais être activé en prod.

## 10. Prochaines actions recommandées (2026-08-09)

1. Appliquer les migrations `20260809*` et `20260810*` en production, puis vérifier que
   `public.ops_grant_drift` et la dernière ligne de `public.ops_ledger_health`
   sont saines.
2. Faire entrer une première agence par `/import`, avec son fichier réel.
   L'import est le point de rupture de l'acquisition.
3. Suivre `ops_ledger_health` sur un mois avant d'engager la phase « contract »
   du grand livre.
4. Trancher le partage de compte entre employés au premier signal terrain
   (ADR-029, remis à plus tard).
5. Retirer les vestiges d'énumération du rail supprimé (`recorded_by = 'psp'`,
   `transactions.source = 'feexpay'`).
