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

Le coeur métier est l'échéance de loyer.

```txt
landlord -> property -> unit -> lease -> rent_due
lease -> reminder rules -> reminders
rent_due -> rent_reception_allocations -> rent_receptions
rent_receptions -> receipts / payment_proofs
```

## Sécurité

Règle fondamentale : un propriétaire ne voit que les données de son `landlord_id`.

La sécurité doit être appliquée à deux niveaux :

1. côté serveur, par résolution du propriétaire courant ;
2. côté base, par RLS Supabase quand applicable.

Une ressource hors périmètre doit retourner `404` plutôt que révéler son existence.

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

## Principes d'implémentation

- Mutations sensibles transactionnelles.
- Idempotence sur les générations et confirmations.
- Audit logs sur actions critiques.
- Pas de suppression silencieuse de données financières.
- Prestataires externes comme adaptateurs, jamais source de vérité métier.

## Docs liées

- `docs/domain-model.md`
- `docs/database.md`
- `docs/api.md`
- `docs/decisions/`
- `docs/gap-analysis-live-db-reminder-proof-engines.md`
- `docs/implementation-plan-reminder-proof-engines.md`
- `docs/ops-deployment.md`

## Limites

Ce fichier est volontairement court.

Les détails opérationnels vont dans `ops-deployment.md`.

Les détails DB vont dans `database.md`.

Les décisions durables vont dans les ADR.
