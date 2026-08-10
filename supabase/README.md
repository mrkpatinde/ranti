# Ranti — Supabase

This folder contains the versioned database foundation for Ranti.

Ranti is the operating system of property management companies: the connected
account is the agency (`landlords`), which manages units on behalf of
non-user owners (`owners`) and closes its month for each of them.

## Project

Development project ref:

```txt
pcxkxeesgusorrpmrkaj
```

## Rules

- Do not modify the database manually from the Supabase SQL editor. Two
  production drifts caused by out-of-migration DDL were repaired on 2026-08-09
  (migration `20260809120200`); `public.ops_grant_drift` must stay empty.
- Every database change must go through a versioned migration, with a header
  explaining the decision.
- Every table in `public` has RLS enabled and is scoped by
  `landlord_id = private.current_landlord_id()`.
- `anon` never writes directly: the tenant-facing paths go through
  `SECURITY DEFINER` token RPCs.
- `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` are granted to neither `anon`
  nor `authenticated`. Logical deletion uses `deleted_at`.
- Money is stored as integers. Never floats.
- Storage buckets and Edge Functions are out of scope unless explicitly
  approved.

## Local workflow

```bash
supabase login
supabase link --project-ref pcxkxeesgusorrpmrkaj
supabase db reset      # replays every migration + seed.sql
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
complète de migrations depuis `001` avant de lancer la suite. Un second job
(`sql`) rejoue la même chaîne et la même suite sur un Postgres 16 nu (rôles et
schéma `auth` substitués), sans la CLI Supabase : les migrations doivent passer
sur les deux montages.

À savoir : un test qui lit des données préexistantes au lieu de semer ses
propres fixtures échouera sur une base fraîche. Deux l'ont fait jusqu'au
2026-07-27, sans que personne le voie — la suite n'était jouée à la main.

## Current scope

Core tables:

- landlords (the account: a property management company)
- owners (mandating owners — no account, no access; ADR-029)
- properties (`owner_id` nullable: NULL means owned by the account itself)
- units
- tenants
- leases
- rent_dues
- rent_receptions
- rent_reception_allocations
- receipts
- reminders, reminder_events, scheduled_reminders
- transactions (ledger, ADR-023)
- idempotency_keys
- audit_logs

Views: `lease_balances`, `owner_month_summary`, `reminder_batch`,
`journal_feed`, plus the service-role-only `ops_*` views
(`ops_grant_drift`, `ops_ledger_health`, `ops_scheduled_reminders`,
`ops_reminder_queue`).

Private schema: `private.app_secrets` (server secrets, no client grant),
`private.ledger_health` (daily ledger equality check).

Removed on 2026-08-09 (ADR-030): `payment_transactions`, `payment_proofs`,
`ledger_notification_events`, the four payment-rail RPCs, and 14 functions with
no application caller.
