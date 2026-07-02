# Ranti — Synchronisation Docs ↔ Code

## Statut

Version 0.1 — règle de maintenance documentaire.

## Problème

Les documents produit, la roadmap, les migrations, la DB live et le code peuvent diverger après chaque sprint.

Une divergence documentaire n'est pas toujours grave, mais elle devient dangereuse quand elle concerne :

- schéma DB ;
- migrations ;
- RLS ;
- reçus/quittances ;
- relances ;
- paiements ;
- auth ;
- déploiement.

## Règle

Chaque sprint qui modifie le comportement métier doit mettre à jour les docs concernées dans le même PR ou dans un PR documentaire explicitement lié.

## Docs sources de vérité

### Produit

- `docs/vision.md`
- `docs/principes.md`
- `docs/personas.md`
- `docs/user-flows.md`
- `docs/research-log.md`

### Domaine et architecture

- `docs/domain-model.md`
- `docs/database.md`
- `docs/api.md`
- `docs/decisions/`

### Implémentation et ops

- `docs/implementation-plan-reminder-proof-engines.md`
- `docs/gap-analysis-live-db-reminder-proof-engines.md`
- `docs/ops-deployment.md`
- `docs/roadmap.md`

### Design

- `docs/design-brief.md`
- `docs/design/` quand les maquettes seront ajoutées.

## Checklist de fin de sprint

Avant merge ou clôture d'un sprint :

- [ ] La roadmap reflète l'état réel.
- [ ] Les ADR nouvelles sont ajoutées si une décision durable a été prise.
- [ ] `database.md` ne contredit pas les migrations.
- [ ] `api.md` reste un document de conventions, pas une fausse spec.
- [ ] Les vraies specs endpoint sont créées séparément si nécessaire.
- [ ] `ops-deployment.md` est mis à jour si une variable, un provider ou une commande change.
- [ ] `research-log.md` est alimenté si un test terrain a eu lieu.
- [ ] `design-brief.md` pointe vers les artefacts visuels réellement produits.

## Règle de correction

Si une divergence est trouvée :

1. noter la divergence ;
2. dire quelle source est la plus fiable à ce moment ;
3. corriger la doc ou le code ;
4. ajouter une note de date si la situation est temporaire.

## Exemple

Si `database.md` annonce une table qui n'existe pas encore en DB live :

- soit la table est une cible future et doit être marquée comme telle ;
- soit la migration manque et doit être planifiée ;
- soit la doc est fausse et doit être corrigée.

## À ne pas faire

- Ne pas laisser une conversation IA devenir la seule source de vérité.
- Ne pas écrire une doc cible comme si elle était déjà implémentée.
- Ne pas mettre une roadmap à jour sans vérifier le code ou la DB si le point est technique.
- Ne pas ajouter des prompts sans stocker les outputs utiles.
