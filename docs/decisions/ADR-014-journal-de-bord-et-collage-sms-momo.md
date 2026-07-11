# ADR-014 — Journal de bord chronologique et collage SMS Mobile Money

## Statut

Accepté — briques base implémentées et appliquées live 2026-07-11 (voir
« Statut d'implémentation »). UI (bottom-sheet + page journal) restante.

## Contexte

Le brief « Journal de bord » (philosophie Granola / ambient computing) demande :
une entrée principale par note vocale ou copier-coller de SMS Mobile Money,
analysée par Gemini, et une lecture du produit comme flux chronologique
d'événements plutôt que comme tableaux de gestion.

Un schéma greenfield (`proprietaires/biens/baux/journal_events`) a été proposé
hors repo. Il contredit la base live (30+ migrations : `landlords → properties
→ units → leases → rent_dues → rent_receptions/collections → receipts →
reminders`) et jetterait les moteurs déjà shippés (échéances, allocations,
quittances, relances, audit). Décision : **adapter la philosophie sur le schéma
existant**, ne rien remplacer.

État de l'existant qui couvre déjà le brief :

- Saisie vocale d'encaissement : shippée (ADR-012), pipeline
  `audio → Gemini (Structured Outputs + portefeuille) → carte de validation →
  /collections/new` (unique point d'écriture).
- Immutabilité financière : déjà garantie par `database.md` (pas de
  suppression silencieuse, statuts `cancelled/reversed`, `audit_logs`
  append-only, corrections par flux ADR-005).

Ce qui manque :

1. Le **collage SMS MoMo** comme deuxième entrée ambiante.
2. Le **journal chronologique** comme vue de lecture principale.

## Décision

### 1. Pas de table `journal_events`

Le journal est une **projection en lecture**, pas une nouvelle source de
vérité. Les événements existent déjà dans les tables métier :

| Événement du journal      | Source existante                              |
|---------------------------|-----------------------------------------------|
| création / activation bail| `leases` (`created_at`, transitions de statut)|
| échéance générée / en retard | `rent_dues` (`due_date`, `status`)         |
| paiement (MoMo, espèces…) | `rent_receptions` (`payment_method`, `received_at`) |
| reçu / quittance émis     | `receipts` (`issued_at`)                      |
| relance envoyée           | `reminders` (auto SMS/WhatsApp) + `reminder_events` (WhatsApp manuel opérateur) |

Implémentation : une **vue SQL** `journal_feed` qui unionne ces tables en
`(landlord_id, event_type, occurred_at, label, amount, currency, ref_table,
ref_id)`. La consommation trie par `occurred_at` décroissant et pagine. Aucune
double écriture, aucun risque de divergence, rien à backfiller.

Sécurité : la vue est créée `with (security_invoker = true)` (PG15+) → elle
s'exécute avec les droits du propriétaire qui interroge, donc la RLS de chaque
table source s'applique. Une vue classique tournerait avec les droits de son
propriétaire et fuiterait le registre de tous les bailleurs. `grant select …
to authenticated` obligatoire (sinon 403 PostgREST avant la RLS — cf. PR #90).

### 2. Collage SMS MoMo = même pipeline que le vocal (ADR-012)

Nouvelle route `POST /api/sms/collection`, jumelle de
`/api/voice/collection` :

1. Le propriétaire colle le texte du SMS MTN MoMo (zone de collage sur le
   tableau de bord, à côté du micro).
2. Le serveur appelle Gemini (Structured Outputs) avec le **portefeuille du
   propriétaire** en contexte : extraction de montant, date, référence de
   transaction, expéditeur → résolution vers un `lease_id`.
3. Validation serveur du `lease_id` (jamais de confiance aveugle — règle
   ADR-012).
4. Carte de validation → `/collections/new?lease_id=…` pré-rempli. Le flux
   d'écriture reste `record_collection → confirm_collection →
   generate_receipt`. Aucun chemin d'écriture parallèle.

Ajout au modèle : **aucune nouvelle colonne**. La colonne
`rent_receptions.payment_reference text` (nullable) existe déjà en prod — la
réutiliser pour la référence de transaction MoMo (ajouter `transaction_ref`
aurait été de la dérive de schéma). Dédup via index unique partiel
`(landlord_id, payment_reference) where payment_reference is not null and
deleted_at is null` → un SMS collé deux fois lève `23505` et est rejeté
proprement.

Transport Gemini : jumeau exact du vocal — `fetch` brut vers
`generativelanguage.googleapis.com/v1beta`, modèle `gemini-flash-lite-latest`,
Structured Outputs (`responseSchema`), `thinkingBudget: 0`, `GEMINI_API_KEY`
serveur uniquement. **Pas** le SDK `@google/generative-ai`, **pas** Gemini 1.5
(flash standard partait en timeout 30-60 s sur cette clé). Extraction :
`amount` (entier XOF), `sender_name`, `transaction_ref`, résolus + `lease_id`
re-validé serveur. L'alias de paiement du propriétaire
(`landlords.payment_alias`) est passé en contexte pour ne pas confondre
destinataire et émetteur.

### 3. Journal = page de lecture principale

Nouvelle page `apps/web` : flux chronologique (composant serveur, données via
`journal_feed`), filtrable par bail/logement. Les écrans de gestion actuels
restent — ils deviennent le détail derrière chaque ligne du journal, comme les
formulaires sont devenus le filet de sécurité derrière le vocal (ADR-012).

## Règles

- Le journal ne s'écrit jamais directement : c'est une projection.
- Le texte brut du SMS est traité puis jeté, comme l'audio (APDP, ADR-012).
- Confirmation humaine avant toute écriture, sortie Gemini re-validée serveur.
- Clé Gemini côté serveur uniquement.
- `payment_reference` visible sur le reçu si présent (traçabilité MoMo).

## Conséquences

- Zéro migration destructive ; un index + une vue (aucune colonne ajoutée).
- Le schéma greenfield est abandonné ; ce document remplace le fichier
  `architecture.md` proposé hors repo.
- Formats réels des SMS MTN Bénin à collecter sur le terrain pour le prompt
  d'extraction (dogfood, comme l'accent pour le vocal).

## Statut d'implémentation (2026-07-11)

Appliqué live (ref `pcxkxeesgusorrpmrkaj`) via migration
`20260711140000_sms_paste_and_journal_feed.sql` :

- Index unique partiel `rent_receptions_landlord_payment_reference_uq` — actif.
- Vue `journal_feed` `security_invoker=true` + `grant select to authenticated`
  — vérifiés live (`reloptions={security_invoker=true}`, grant présent).

Code (typecheck OK) :

- `apps/web/src/app/api/sms/collection/route.ts` — route jumelle du vocal,
  n'écrit jamais, pré-contrôle de doublon sur `payment_reference`.
- `apps/web/src/lib/sms/{types,gemini,index}.ts` — extraction Structured
  Outputs. Réutilise `getVoicePortfolio` de `lib/voice`.

Restant : bottom-sheet consommant `SmsCollectionResponse` (collage → carte →
`/collections/new` avec `payment_reference` écrit à l'insertion), page journal
lisant `journal_feed`, design monochrome (/design-consultation). `GEMINI_API_KEY`
déjà en prod (partagée avec le vocal).

## Hors périmètre

- Écoute ambiante continue (exclue — ADR-012 : batterie, data).
- Transfert automatique des SMS (pas d'accès programmatique aux SMS sur
  iOS/Android web) : le collage manuel est le geste ambiant réaliste.
- Refonte visuelle « monochrome premium » : passe par /design-consultation,
  pas par cet ADR.
