# Audit sécurité — couche d'isolation propriétaire (2026-07-15)

## Objet

Vérifier, avant de construire le tunnel UI, que la « Security Layer » d'isolation
par propriétaire tient réellement : un `auth.uid()` A ne peut NI lire, NI insérer,
NI modifier les données d'un propriétaire B. Le brief initial demandait de
construire cette couche autour d'une colonne `owner_id` (triggers d'intégrité,
policy unique `owner_only_access`, grants). **Cette couche existe déjà en
production sous le nom `landlord_id`, et elle est conforme aux docs.** L'audit ne
la recrée pas : il la vérifie et documente l'écart de vocabulaire.

## `owner_id` → `landlord_id` : pourquoi le design du brief n'a pas été appliqué

La colonne d'appartenance de tout objet métier est **`landlord_id`**, imposée par
[docs/database.md](database.md) (« `landlord_id` sur toutes les tables métier »).
Règle docs-first : introduire `owner_id` contredirait la doc source → rejeté.
Appliquer littéralement le brief serait une **régression**, pas une amélioration :

1. **`owner_id` n'existe nulle part.** La table « transactions » du brief est
   `payment_transactions`. Renommer casserait le ledger, les RPC et le code applicatif.
2. **`USING (owner_id = auth.uid())` casserait l'isolation.** `landlord_id` est une
   FK vers `landlords.id`, **pas** `auth.users.id`. `auth.uid()` renvoie l'id
   auth-user. Le dépôt fait le pont via `private.current_landlord_id()`
   (`auth.uid()` → `landlords.id`). Une comparaison brute `= auth.uid()` ne
   matcherait rien → lock-out total, pas de la sécurité.
3. **Une policy unique avec seulement `USING` = trou à l'INSERT.** Postgres ignore
   `USING` sur INSERT et n'évalue que `WITH CHECK`. Le dépôt utilise des policies
   par action avec `with check` explicite sur insert/update
   ([002_rls_policies.sql](../supabase/migrations/002_rls_policies.sql)).
4. **Les triggers BEFORE INSERT copiant l'owner ne sont pas le pattern.**
   L'appartenance à l'écriture est portée par le `with check` RLS + les RPC
   `SECURITY DEFINER` `private.*_core`. Un trigger de copie serait redondant.
5. **Le risque « GRANT oublié » est déjà couvert** par des migrations de grants
   explicites (`20260714170000`, `20260714153000`) et des tests garde-fous.

## Matrice de couverture (vérifiée)

Helper : `private.current_landlord_id()` (SECURITY DEFINER, `search_path = ''`,
schéma `private` non exposé PostgREST). Policies `to authenticated`.

| Table                  | SELECT                              | INSERT (with check)                  | UPDATE (using + with check)          |
|------------------------|-------------------------------------|--------------------------------------|--------------------------------------|
| `properties`           | `properties_select_own`             | `properties_insert_own`              | `properties_update_own`              |
| `tenants`              | `tenants_select_own`                | `tenants_insert_own`                 | `tenants_update_own`                 |
| `leases`               | `leases_select_own`                 | `leases_insert_own`                  | `leases_update_own`                  |
| `payment_transactions` | `payment_transactions_select_own` *(colonne, hors marge)* | — *(écriture RPC definer only)* | — *(écriture RPC definer only)* |

Toutes comparent `landlord_id = private.current_landlord_id()`. `payment_transactions`
n'a **pas** de voie d'écriture `authenticated` (seules les RPC definer écrivent) et
n'expose que la vision reçu par grant de colonne — `net_margin` (marge Ranti) reste
invisible du propriétaire.

## Vérification exécutée

Test négatif : [supabase/tests/cross_tenant_isolation.test.sql](../supabase/tests/cross_tenant_isolation.test.sql).
Deux propriétaires A et B ; sous `set local role authenticated` + JWT du tenant :

- **Lecture** — A ne voit 0 ligne de B sur les 4 tables (RLS filtre même sur
  `where landlord_id = B`), et voit exactement ses propres lignes.
- **Insert** — insérer avec `landlord_id = B` sur `properties`/`tenants`/`leases`
  lève (RLS `with check`).
- **Update** — modifier `where landlord_id = B` touche 0 ligne.
- **Symétrie** — même résultat B → A.
- **Colonne ledger** — `net_amount` lisible, `net_margin` refusé.

Exécuté (rollback-wrapped, aucune donnée persistée — fuite vérifiée à 0) contre le
projet **prod `pcxkxeesgusorrpmrkaj`** via MCP `execute_sql` → `… : OK`. C'est le run
prod-shaped qui compte : il prouve l'isolation sous les **défauts de grants legacy
de prod**, là où une vérif policy-only pourrait tromper. (Pas de stack Postgres
local disponible dans la session ; le fichier reste rejouable en local via `psql`.)

## Écart trouvé — à traiter séparément

- **ADR-002 (verrou identité propriétaire) non implémenté.** Vérifié en prod :
  `landlords` porte seulement `landlords_audit` (AFTER) et `set_updated_at`, **aucun
  BEFORE UPDATE** verrouillant `first_name`/`last_name`/`civility`/`phone`. La policy
  `landlords_update_own` vérifie `auth_user_id = auth.uid()` mais **pas** l'immutabilité
  de ces colonnes → un propriétaire authentifié peut aujourd'hui modifier son propre
  nom/téléphone directement en base. C'est exactement le « verrouillé en UI, modifiable
  en DB = fausse sécurité » que l'ADR-002 proscrit. **Recommandation :** l'implémenter
  comme sa propre tâche P0 (trigger BEFORE UPDATE ou `with check` colonne + RPC
  `SECURITY DEFINER` audité en même transaction, cf. [ADR-002](decisions/ADR-002-owner-identity-lock.md)),
  hors périmètre de cet audit.

## Conclusion

La couche d'isolation `landlord_id` bloque prouvablement lecture / insert / update
cross-tenant sur `properties`, `tenants`, `leases`, `payment_transactions`, sous les
grants réels de prod. La classe de bug récurrente « policy correcte + GRANT oublié »
est fermée par grants explicites + tests. Seul l'ADR-002 reste ouvert. Le tunnel UI
peut s'appuyer sur cette isolation ; l'ADR-002 est le prochain item sécurité.
