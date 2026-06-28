# ADR-002 — Identité propriétaire verrouillée

## Statut

Accepté (CEO, 2026-06-28).

## Contexte

`landlords` contient des données sensibles : nom, prénom, civilité, téléphone — liées à l'identité du compte et aux loyers. La policy RLS `landlords_update_own` autorise aujourd'hui la modification libre de ces colonnes. L'UI a déjà été verrouillée (PR « lock owner profile edits ») et l'action serveur aussi, mais la base reste techniquement modifiable. « Verrouillé en UI, modifiable en DB » = fausse sécurité.

## Décision

L'identité propriétaire (`first_name`, `last_name`, `civility`, `phone`) n'est **pas modifiable librement**.

- Au repos, la base **rejette** tout changement de ces colonnes.
- Un changement n'est possible que via un **flux RPC sécurisé explicite**, qui exige un motif et écrit un `audit_logs` dans la **même transaction** (voir [ADR-006]).
- Le **changement de téléphone** suit une **règle spéciale** : le téléphone est l'identifiant de connexion (auth phone+password). Le modifier touche l'authentification → flux dédié avec re-vérification, jamais un simple update de champ.
- Les champs non-identité (préférences éventuelles) restent libres.

## Conséquences

- Migration : `BEFORE UPDATE` trigger (ou RLS `with_check` colonne-par-colonne) sur `landlords` rejetant tout changement des colonnes d'identité hors RPC dédié.
- Fonction(s) RPC `SECURITY DEFINER` pour les changements légitimes, avec audit transactionnel.
- Le changement de téléphone reste hors scope MVP immédiat (flux re-vérification à concevoir) — bloqué par défaut d'ici là.
- Cet ADR est implémenté **en dernier** dans l'ordre P0 : il exige un flux propre, pas un trigger bâclé.
