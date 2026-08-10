# Ranti

Ranti est le système opérationnel des entreprises de gestion immobilière au
Bénin, puis en zone UEMOA. Le compte connecté est l'agence : elle suit les
loyers de son portefeuille, relance ses locataires, édite ses quittances et
produit chaque mois le relevé de chacun de ses propriétaires mandants.

## Statut

Vérifié le 2026-08-09 contre le code, après le pivot entreprises de gestion
(ADR-029) et le retrait du rail de paiement (ADR-030). Toute ligne de cette
section est vérifiable dans `apps/web/src` ou `supabase/migrations` ; en cas de
doute, **le code fait foi et le README est faux**.

La boucle locative est livrée de bout en bout : propriétés, lots, locataires,
baux, génération des échéances, encaissements avec allocations,
reçus/quittances, journal d'audit, RLS.

**Périmètre : loyer seul (ADR-026).** Les charges variables sont retirées du
produit depuis v0.3.34.0 ; leurs objets DB ont été supprimés de la base le
2026-08-09 (migration `20260809120100`).

**Rapport à l'argent.** Ranti ne détient jamais les fonds et aucun prestataire
de paiement n'intervient. Le loyer circule directement du locataire à l'agence
(espèces, Mobile Money, virement, ou alias de paiement de l'agence). Le rail
custodial décidé par ADR-018 et ADR-019, gelé par ADR-024, a été supprimé du
dépôt et de la base le 2026-08-09. Le produit est gratuit, sans limite de lots,
jusqu'à nouvel ordre (ADR-028) : aucun prix affiché, engagement de préavis.

**Relances.** Ranti n'envoie rien lui-même — aucun déclencheur d'envoi
n'existe dans ce dépôt. Le produit fournit la file (`/reminders/batch`), le
message pré-rédigé et la trace ; le message part du WhatsApp du gestionnaire
par lien `wa.me` (ADR-022). Les réglages de relance par compte sont persistés,
avec échec d'écriture remonté à l'UI (correctif 2026-07-27), mais la file
d'envoi opérée hors dépôt ne les lit pas encore.

**Certification locataire.** Le locataire ne crée pas de compte : il reçoit un
lien à jeton, peut certifier ou contester une quittance, et le document se
vérifie publiquement sur `/verifier/<id>` ou par référence sur `/verifier`.

Variables d'environnement réellement lues par le code : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_AXEPTIO_CLIENT_ID`, `NEXT_PUBLIC_NOTION_HELP_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `RANTI_LOCAL_AUTH*` (dev seulement). `SUPABASE_SECRET_KEY` n'est plus lu que par `lib/supabase/admin.ts`, sans appelant depuis le retrait du webhook (ADR-030). Les `FEEXPAY_*` ont disparu avec le rail. **`CRON_SECRET` n'existe nulle part** dans le code.

Détail opérationnel : `docs/BUILD_STATUS.md`.

## Problème unique

Aider une entreprise de gestion à savoir clairement :

1. qui a payé ;
2. qui est en retard, sur l'ensemble du portefeuille ;
3. quelle relance doit partir ;
4. quelle quittance existe après validation ;
5. ce qui revient à chaque mandant à la fin du mois, honoraires déduits.

## Boucle produit

1. l'agence importe son portefeuille : mandants, biens, lots, locataires, baux ;
2. Ranti génère les échéances à partir des baux ;
3. l'agence relance ses retards en une passe ;
4. l'agence valide les encaissements reçus ;
5. Ranti génère la quittance ou le reçu adapté ;
6. Ranti produit le relevé mensuel de chaque mandant ;
7. Ranti conserve l'historique et les preuves.

## Trois moteurs produit

### Reminder Engine

À partir du bail et des échéances, Ranti prépare les relances du portefeuille et
en conserve la trace. L'envoi part du WhatsApp du gestionnaire (ADR-022).

Statut : file, message pré-rédigé et journalisation par lot livrés
(`/reminders/batch`, `log_reminder_batch`). La cadence de référence
(J-5 / J-1 / jour J / J+3 / J+10, `lib/reminders/schedule.ts`) est calculée
ici ; **l'envoi reste un geste humain** — aucun déclencheur, aucun appel à un
fournisseur de messagerie dans ce dépôt (ADR-022).

### Proof Engine

À partir d'un encaissement validé, Ranti génère le document adapté : reçu
partiel, reçu complet ou quittance.

Statut : implémenté. Numérotation atomique `RNT-AAAA-NNNN`, snapshot archivé,
correction par remplacement, sceau HMAC sous secret serveur. Aucun document
n'est généré sans allocation financière réelle.

### Closing Engine

À partir du mois écoulé, Ranti compose le relevé de chaque mandant : par lot,
attendu, encaissé, honoraires, net à reverser.

Statut : implémenté (`/cloture`, `owner_statement`, `owner_month_summary`, PDF).

## État livré

- auth du compte (Google, ADR-010) et verrou d'identité (ADR-002) ;
- propriétés, lots, locataires, baux, activation et fin de bail ;
- génération des échéances (ADR-004) ;
- encaissements et allocations aux échéances ;
- reçus et quittances, conformes au bail d'habitation béninois (ADR-027) —
  moyen de paiement et date de réception sur la quittance partagée, libellés
  centralisés dans `lib/receipts/labels.ts` ;
- empreinte d'intégrité **scellée à l'émission** (migrations `20260727120000`
  + `20260727120010`), recette unique `private.receipt_computed_fingerprint`
  partagée par l'émission, la certification et les deux chemins de
  vérification ; **durcie en HMAC sous secret serveur** le 2026-08-09
  (migration `20260809120300`) : la certification locataire est infalsifiable
  par l'émetteur, le jeton de partage s'obtient par une RPC journalisée ;
- vérification publique des quittances : par lien/QR (`/verifier/[id]`) et par
  référence `RNT-AAAA-NNNN` (`/verifier`, chemin énumérable donc volontairement
  pauvre : ni nom, ni logement, ni montant, ni empreinte) ; ambiguïté des
  références levée par le nom du bailleur (filtre d'entrée, jamais affiché) ;
  exemple statique `/verifier/demo` ;
- certification et contestation locataire par lien à jeton (ADR-013) ;
- journal de bord chronologique (`/journal`) ;
- tableau de bord mensuel ;
- **import de portefeuille par fichier** (`/import`) : aperçu ligne par ligne
  puis import tout-ou-rien idempotent ;
- **propriétaires mandants** (`/owners`) : honoraires de gestion en points de
  base, rattachement des biens ;
- **clôture mensuelle** (`/cloture`) : vue par mandant, relevé détaillé et PDF ;
- **relances par lot** (`/reminders/batch`) ; réglages de relance persistés
  par compte, échec d'écriture remonté à l'UI ;
- audit logs et RLS sur toutes les tables métier ;
- pages légales (CGU, confidentialité) et page publique « À propos »
  (`/a-propos`) ;
- système de design (`DESIGN.md`) appliqué aux écrans, palette claire seule ;
- intégration continue : lint, tests unitaires, build, rejeu des migrations et
  des tests SQL (jobs `db` et `sql`), et parcours e2e Playwright sur une pile
  Supabase locale (job `e2e`) — `.github/workflows/ci.yml`.

## À compléter

- phase « contract » du grand livre (ADR-023) : les deux modèles comptables
  coexistent, l'égalité est contrôlée chaque nuit sans être résolue ;
- partage d'un compte entre les employés d'une agence, avec rôles (ADR-029,
  remis à plus tard) ;
- retrait des vestiges d'énumération du rail supprimé ;
- E2E authentifié pour les parcours agence (`/import`, `/cloture`,
  `/reminders/batch`) ;
- faire honorer les réglages de relance par la file d'envoi opérée hors dépôt ;
- aligner les versions de migration dépôt ↔ prod (l'API horodate elle-même :
  `20260727152507` en prod pour `20260727120000` au dépôt — `supabase db push`
  n'est pas utilisable en l'état) ;
- validation terrain documentée (`docs/research-log.md`).

Suivi détaillé : `TODOS.md`.

## Développement

```bash
cd apps/web
bun install
bun run dev        # http://localhost:3000
bun run lint
bun run test
bun run build
```

Base de données : `supabase/README.md`.

## Sources de vérité

Produit :

```txt
docs/vision.md
docs/positioning.md
docs/principes.md
docs/personas.md
docs/user-flows.md
docs/research-log.md
```

Domaine et architecture :

```txt
docs/domain-model.md
docs/glossary.md
docs/database.md
docs/api.md
docs/architecture.md
docs/decisions/
```

Implémentation et ops :

```txt
docs/roadmap.md
docs/ops-deployment.md
docs/docs-sync.md
TODOS.md
```

Design :

```txt
DESIGN.md
docs/design-brief.md
docs/design/
```

## Règle de construction

Aucune fonctionnalité n'entre dans Ranti si elle ne rend pas plus simple le fait
de faire entrer un portefeuille, de savoir qui a payé et qui est en retard, de
relancer, de produire une preuve après validation d'un encaissement, ou de
clôturer le mois pour un mandant.
