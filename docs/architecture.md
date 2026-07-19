# Ranti — Architecture

## Statut

Version 0.1 — vue d'ensemble.

Ce fichier existe pour rendre cohérente la roadmap Phase 0, qui référence l'architecture comme livrée.

Il ne remplace pas `docs/database.md`, `docs/api.md`, ni les ADR.

## Objectif

Décrire les grands choix d'architecture de Ranti sans entrer dans les détails de chaque endpoint ou migration.

## Produit

Ranti est un registre de loyer actif.

Le propriétaire renseigne les baux. Ranti génère les échéances, prépare les rappels/relances, trace les paiements validés et conserve les reçus/quittances.

## Stack applicative

- Frontend / app : Next.js dans `apps/web`.
- Langage : TypeScript.
- UI : React.
- Backend applicatif : server actions / logique serveur dans l'app web.
- Base de données : Supabase Postgres.
- Auth : Supabase Auth.
- Stockage fichiers : Supabase Storage ou adaptateur équivalent à confirmer.
- Déploiement : Vercel pour l'app web.

## Dépôt

Structure principale (une seule app — pas de workspaces ni de `packages/` partagés ; le mot « monorepo » surdéclarait la réalité) :

```txt
apps/web
supabase/migrations
docs
```

Les commandes racine délèguent vers `apps/web` (`bun --cwd`). La landing vit DANS l'app (`app/(public)`) et partage naturellement les tokens de `globals.css` ; si une landing séparée est un jour extraite, les tokens devront être sortis dans un package dédié — rien n'est prévu pour ça aujourd'hui.

## Domaine central

Cible (ADR-023 « Grand Livre de Confiance ») : le coeur métier est le
**compte courant locatif** — toute somme due ou reçue sur un bail est une
ligne de `transactions` (loyer, réparation, frais, règlement,
contre-passation), avec un statut de reconnaissance
(`pending`/`validated`/`disputed`/`withdrawn`) et un solde par bail en trois
nombres jamais fusionnés (vue `lease_balances`).

État de la transition (phase Expand, en cours) : les tables héritées restent
la source de vérité et l'échéance de loyer reste la mécanique opérante ; le
grand livre est tenu en miroir (triggers + backfill idempotent) avec une
garde d'égalité des soldes qui conditionne la bascule des lectures.

```txt
landlord -> property -> unit -> lease -> rent_due
lease -> reminder rules -> reminders
rent_due -> rent_reception_allocations -> rent_receptions
rent_receptions -> receipts / payment_proofs
lease -> transactions -> lease_balances   (grand livre ADR-023, miroir)
```

## Sécurité

Règle fondamentale : un propriétaire ne voit que les données de son `landlord_id`.

La sécurité doit être appliquée à deux niveaux :

1. côté serveur, par résolution du propriétaire courant ;
2. côté base, par RLS Supabase quand applicable.

Une ressource hors périmètre doit retourner `404` plutôt que révéler son existence.

Session dans le proxy (v0.3.33.0) : le middleware valide le jeton d'accès localement (signature ES256, JWKS en cache) au lieu d'interroger le serveur Auth à chaque navigation. Limite assumée, patron recommandé par Supabase : une session révoquée à distance (déconnexion globale, réinitialisation de mot de passe) reste valable jusqu'à l'expiration du jeton d'accès (TTL projet, 1 h par défaut).

## Données sensibles

Ranti manipule :

- identités propriétaires ;
- identités locataires ;
- montants de loyers ;
- statuts de paiement ;
- retards ;
- preuves ;
- reçus/quittances.

Ces données ne doivent jamais être exposées publiquement sans lien contrôlé.

## Moteurs produit

### Reminder Engine

Cible : à partir du bail et des échéances, Ranti prépare ou automatise les rappels et relances.

Statut : **tranché par ADR-022** (2026-07-16). La cadence de référence (J-5 / J-1 / jour J / J+3 / J+10) vit dans ce dépôt (`lib/reminders/schedule.ts`, affichée au dashboard et sur la fiche bail) ; **l'envoi est opéré par ranti-ops** (WhatsApp), qui trace chaque envoi dans `reminder_events` — lu par les écrans `/reminders` et la fiche bail. L'ancien cron SMS dormant de ce dépôt est supprimé. `lease_reminder_rules` (règles par bail) reste gaté sur signal terrain.

### Proof Engine

Cible : après validation d'un paiement par le propriétaire, Ranti génère automatiquement le document adapté.

Statut : cible documentée. La DB live contient déjà `receipts.kind` et `snapshot`, mais l'audit code doit confirmer le niveau d'automatisation réel.

### Grand Livre (ADR-023)

Cible : le solde de chaque bail (certain / en attente / en litige) se calcule
en base à partir des lignes de transactions, et le locataire valide ou
conteste les dettes affirmées par lien signé.

Statut : **phases Expand, Nouvelle lecture et « différenciant » (produit)
livrées** — table `transactions`, vue `lease_balances`, machine à états
(terminalité, indélébilité, contre-passation bornée), miroir des tables
héritées, garde d'égalité restreinte à la projection héritée ; le dashboard
lit le grand livre (`lib/ledger`, une ligne par bail, dette consolidée en
compte courant) ; charges variables (réparations/frais) créées, retirées ou
corrigées depuis la fiche bail, validées ou contestées par le locataire via
`/transaction/[token]` (lien signé, sans compte). « Payé / Attendu » et le
taux de recouvrement restent des lentilles mensuelles sur
`rent_due_balances`. **Relances et fiche bail sont basculées sur le compte
courant** : la file `ops_reminder_queue` ne sort une relance de retard que si
le bail a un impayé au grand livre (garde reprise par la projection UI), et
la fiche bail affiche le solde du compte en tête. Reste : branchement de
l'envoi automatisé des notifications de charges côté ranti-ops (vue
`ops_ledger_notifications`), puis phase Contract.

## Principes d'implémentation

- Mutations sensibles transactionnelles.
- Idempotence sur les générations et confirmations.
- Cache client de navigation (30 s, `staleTimes`) : toute écriture d'argent doit purger l'ensemble des surfaces qui l'affichent via `revalidateMoneySurfaces` (`apps/web/src/lib/cache/money.ts`) ; aucune surface argent ne doit être ajoutée sans y être inscrite.
- Audit logs sur actions critiques.
- Pas de suppression silencieuse de données financières.
- Prestataires externes comme adaptateurs, jamais source de vérité métier.

## Docs liées

- `docs/domain-model.md`
- `docs/database.md`
- `docs/api.md`
- `docs/decisions/` (dont ADR-023 — Grand Livre de Confiance, document de référence du pivot)
- `docs/gap-analysis-live-db-reminder-proof-engines.md`
- `docs/implementation-plan-reminder-proof-engines.md`
- `docs/ops-deployment.md`

## Limites

Ce fichier est volontairement court.

Les détails opérationnels vont dans `ops-deployment.md`.

Les détails DB vont dans `database.md`.

Les décisions durables vont dans les ADR.
