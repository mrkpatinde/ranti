# Contexte de session — Pivot « Grand Livre de Confiance » (2026-07-16)

Sauvegarde de contexte pour reprise (`/context-restore`). Session Claude :
`session_01LYXepMaJivobB3Ge8YjNVN`. Tout ce qui est décrit ici est mergé et
en production, sauf mention contraire.

## Ce qui a été livré aujourd'hui

Pivot stratégique complet, du brief CEO à la production, sur deux dépôts :

| Livraison | Où | Version |
| :-- | :-- | :-- |
| ADR-023 « Grand Livre de Confiance » (document de référence : matrice de validation, cycle de vie du litige, plan de transition) | ranti #174 | — |
| Phase Expand : table `transactions`, machine à états indélébile, miroir des tables héritées, backfill idempotent, garde d'égalité | ranti #174 | v0.3.22.0 |
| Phase Nouvelle lecture : dashboard impayés & soldes par bail (`lib/ledger`, vue `lease_balances`) | ranti #174 | v0.3.23.0 |
| Phase différenciant : charges variables, page publique `/transaction/[token]` (valider/contester/retirer), retrait/remplacement bailleur, vue `ops_ledger_notifications` | ranti #174 | v0.3.24.0 |
| Bascule relances + fiche bail sur le compte courant (garde `ops_reminder_queue`, projection UI alignée, solde en tête de fiche) | ranti #175 | v0.3.25.0 |
| Cockpit : file « Compte du bail — charges à notifier » (locataire pour validation, propriétaire pour litige, dédup 7 j, traçage `ledger_notification_events`) | ranti-ops #7 | — |

Migrations appliquées sur Supabase (projet `pcxkxeesgusorrpmrkaj`), dans
l'ordre : `ledger_transactions_expand`, `ledger_charges_tenant_flow`,
`ledger_gates_reminders`, `ledger_notification_events`. Toutes vérifiées en
live après application (garde d'égalité à zéro, colonnes, grants, RPC).

## Décisions structurantes (au-delà de l'ADR)

- **Miroir par triggers en base**, pas de double écriture applicative : les
  RPC SQL (`generate_rent_dues`, rail PSP, chemins ops) sont couvertes
  d'office, atomiquement. Acté en ADR-023 v2.1.
- **Garde d'égalité restreinte à la projection héritée** (loyers/règlements) :
  une charge validée est une vérité que le legacy ignore par construction.
- **Exigibilité héritée par la contre-passation** (vue `lease_balances`) :
  annuler une échéance future ne réduit pas l'impayé du jour. Bug trouvé par
  test, ne se manifestait qu'entre le 1er et le jour d'échéance du mois.
- **Le chiffre rouge d'une ligne dashboard = l'impayé seul** (la somme des
  lignes rouges recolle avec la tuile Retard) ; l'attendu est nommé à part.
  Trouvé par review adversariale multi-agents.
- **`reminder_events` inutilisable pour les charges** (`rent_due_id NOT
  NULL`, types en CHECK) → table dédiée `ledger_notification_events` +
  file `ops_ledger_notification_queue` (dépôt ranti-ops, base partagée).
- Le mot « transactions » côté UI appartient au rail PSP (`/transactions`,
  « paiements par le rail ») — le grand livre dit « compte du bail ».

## Vérification — harnais Postgres local

Les 67 migrations + suite SQL (15 tests) tournent sur un Postgres 16 local
avec shims Supabase. Scripts sauvegardés dans `docs/context/pg-harness/`
(copies de session ; chemins de logs rendus portables vers
`/tmp/pg-harness-logs`) :

- `setup.sh` — cluster jetable + shims (`auth.uid()`, rôles anon/
  authenticated/service_role, extension pg_cron factice) + rejeu des
  migrations du repo dans l'ordre lexicographique.
- `run-tests.sh [filtre]` — exécute `supabase/tests/*` ; état de référence :
  **15 PASS, 4 FAIL préexistants** (authenticated_grants : signature
  `record_collection_core` 11 args supprimée le 14/07 ; collection_grants,
  landlord_payment_alias, tenant_declaration_method_reference : sensibles à
  la date du jour). Tout échec au-delà de ces 4 = régression.
- `validate-backfill.sh` — backfill sur base peuplée (tous états legacy) +
  idempotence ; diffère les migrations ledger listées en tête du script.

Après la migration ops : appliquer aussi
`ranti-ops/supabase/migrations/20260717000000_ledger_notification_events.sql`
sur `ranti_test` pour tester la file cockpit.

## Routine armée

`trig_01AziZpX7pR6baai6y4qQRqs` — one-shot **2026-08-17T08:00Z**, se déclenche
dans cette session : ouvrir la **phase Contract** (état des lieux d'abord :
garde d'égalité, volumétrie, taux de validation locataire — la métrique de
survie du pivot ; ne pas ouvrir si les signaux terrain sont mauvais ;
validation utilisateur requise avant migration de gel ou PR). Attention : le
déclencheur ne stocke pas les connecteurs MCP — Supabase/GitHub seront à
raccrocher au réveil.

## En suspens

1. **`docs/database.md` (ranti)** : ajouter `ledger_notification_events` et
   `ops_ledger_notification_queue` à la liste « Tables live hors modèle
   initial » — une ligne, à glisser dans le prochain changement ranti.
2. **Phase Contract** (mi-août, routine ci-dessus) : lectures 100 % grand
   livre, gel des tables héritées en lecture seule, retrait du miroir et de
   `legacy_ref` — jamais de suppression de données financières.
3. Types futurs du grand livre non engagés : pénalités, dépôt de garantie
   (hors périmètre ADR-023).
4. Advisors Supabase préexistants (hors périmètre) : `product_events` RLS
   sans policy ; protection mots de passe compromis désactivée (sans objet,
   auth Google-only ADR-010).

## Conventions de travail apprises

- Docs d'abord (CLAUDE.md) : ADR → docs → migration → code → tests, et le
  code doit rester 100 % conforme aux docs. `DESIGN.md` avant toute UI
  (tokens sémantiques seulement, `formatFcfa` unique, cibles ≥ 44 px, pas
  d'eyebrows, voix « vous »).
- Un commit versionné par PR (squash, titre `vX.Y.Z type: … (#PR)`),
  CHANGELOG + VERSION à chaque livraison.
- Migrations forward-only, appliquées via MCP `apply_migration` (retirer le
  `begin;`/`commit;` externe). Toujours vérifier l'état live après.
- ranti-ops : branche par défaut `master`, pas de CI GitHub Actions (Vercel
  seulement), migrations partagées possibles dans son propre `supabase/`.
- La définition live d'une vue ops peut différer du repo (précédent
  `sliding_reminder_windows`) : vérifier `pg_get_viewdef` avant tout
  `create or replace` d'une vue du contrat ops.
