# ADR-006 — Audit des mutations sensibles

> ⚠️ **Collision de numéro.** Deux ADR portent le numéro 006 :
> celui-ci (audit) et
> [ADR-006 — Rappels et relances automatiques](ADR-006-automated-reminders-from-lease.md).
> Une référence nue à « ADR-006 » est ambiguë — vérifier le contexte.
> Répartition observée au 2026-07-17 : ADR-002, ADR-005 et les migrations SQL
> (`sensitive_mutation_audit`, `landlord_identity_lock`, `receipt_correction_flows`)
> visent **l'audit (ce document)** ; `roadmap.md`, `database.md`,
> `implementation-plan-*` et ADR-019 § 6 visent **les relances**.
> Renumérotation non faite : elle exigerait de modifier des commentaires `.sql`.

## Statut

Accepté (CEO, 2026-06-28).

## Contexte

`audit_logs` existe (`metadata jsonb NOT NULL`, pas de colonnes `before_data`/`after_data`). En base live : seulement les actions `created` et `updated` sont tracées (via triggers). Aucune trace des transitions sensibles : annulation, confirmation, génération, archivage. La doc prévoyait `before_data`/`after_data`, divergence avec le schéma réel.

## Décision

### Schéma

Garder `metadata jsonb` (pas de churn de schéma). Convention : `metadata` porte `{ before, after, reason }` selon le besoin. **La doc est mise à jour** pour officialiser `metadata` ; la table n'est pas modifiée.

### Couverture

Toute mutation sensible écrit un audit :
`cancel_collection`, `cancel_receipt`, `cancel_rent_due`, `confirm_collection`, `generate_rent_dues`, `generate_receipt`, `archive*`, et le changement d'identité propriétaire ([ADR-002]).

### Garanties (non négociables)

- **Transactionnel, fail-closed** : l'audit est écrit dans la **même transaction** que la mutation. Si l'audit échoue, la mutation échoue. Pas de « on essaie d'écrire le log après ».
- **Inviolable côté utilisateur** : l'utilisateur ne peut **ni modifier ni supprimer** ses audit logs. Pas de policy `UPDATE`/`DELETE` pour `authenticated` sur `audit_logs`. Lecture éventuellement limitée à ses propres données ; écriture uniquement via backend/RPC `SECURITY DEFINER`.
- **Fonction d'audit standard** : une fonction unique (ex. `private.write_audit(entity_type, entity_id, action, metadata)`) appelée par toutes les mutations, pour éviter le désordre et garantir un format constant.

## Conséquences

- Construire la matrice « action sensible → audit attendu → audit réel » et combler les trous.
- Ajouter/compléter les appels d'audit dans chaque RPC sensible.
- Migration : policies `audit_logs` (lecture restreinte, aucune écriture directe `authenticated`), fonction `write_audit` standard.
- Mettre à jour `docs/database.md` pour officialiser la convention `metadata`.
