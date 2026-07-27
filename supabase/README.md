# Ranti — Supabase

This folder contains the versioned database foundation for Ranti.

## Project

Development project ref:

```txt
pcxkxeesgusorrpmrkaj
```

## Rules

- Do not modify the database manually from the Supabase SQL editor.
- Every database change must go through a versioned migration.
- RLS policies are not part of the first schema migration. They will be added in a dedicated security migration.
- Storage buckets and Edge Functions are Post-MVP for now unless explicitly approved.

## Local workflow

```bash
supabase login
supabase link --project-ref pcxkxeesgusorrpmrkaj
supabase db reset
```

## Tests SQL

`supabase/tests/` contient des tests transactionnels (données jetables, vraies
RPC, `ROLLBACK` final — aucun effet persistant). Ils couvrent ce que les tests
JS ne peuvent pas voir : politiques RLS, `GRANT ... EXECUTE`, triggers d'audit,
et le comportement des fonctions sous le rôle `authenticated` plutôt que sous
`postgres` (qui contourne tous les privilèges).

```bash
supabase db start && supabase db reset
supabase/tests/run-all.sh
```

Le runner rend un code de sortie non nul dès qu'un test échoue. Il tourne à
l'identique en CI (`.github/workflows/ci.yml`, job `db`), qui rejoue la chaîne
complète de migrations depuis `001` avant de lancer la suite.

À savoir : un test qui lit des données préexistantes au lieu de semer ses
propres fixtures échouera sur une base fraîche. Deux l'ont fait jusqu'au
2026-07-27, sans que personne le voie — la suite n'était jouée à la main.

## Current scope

The first migration includes only MVP tables:

- landlords
- properties
- units
- tenants
- leases
- rent_dues
- rent_receptions
- rent_reception_allocations
- payment_proofs
- receipts
- audit_logs
