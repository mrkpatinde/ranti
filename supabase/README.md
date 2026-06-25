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
