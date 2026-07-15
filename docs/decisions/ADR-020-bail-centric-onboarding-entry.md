# ADR-020 — Entrée d'onboarding unique « créer un bail »

## Statut

Accepté (2026-07-15). Étend ADR-016. Met à jour welcome-flow.md (v1.3).

## Contexte

Décision CEO 2026-07-15 : réduire la surface de l'app à quelque chose de
minimaliste, fluide, sans friction. L'onboarding actuel est un parcours linéaire
en cinq gestes (lieu → logement → occupant → bail → activation), chacun sur son
propre écran (`/properties/new`, `/units/new`, `/tenants/new`, `/leases/new`),
avec un `buildNextAction` qui guide étape par étape (welcome-flow.md v1.2,
étape 8 : « ajouter son premier bien »).

ADR-016 avait déjà posé que **le bail est la clé de voûte** et introduit
l'onboarding combiné (logement + occupant + bail en un écran) via la RPC
atomique `bulk_onboard_portfolio`, mais l'entrée par défaut restait le lieu.

## Décision

### 1. Entrée unique = « créer un bail »

Un seul bouton « Bail ». L'écran combiné crée, dans un même geste,
lieu + logement + occupant + bail, puis **active le bail et génère les
échéances immédiatement** (activate_lease → generate_rent_dues, ADR-004).

Le lieu se **crée inline OU se pioche** parmi les lieux existants : un
propriétaire vierge ne voit qu'un champ ; un propriétaire établi réutilise son
bâtiment (cas terrain « 6 chambres, 1 lieu »). La hiérarchie
lieu → logement → occupant → bail est **conservée en base** (domain-model
inchangé) ; seule l'UX est unifiée.

### 2. Bail = entrée exclusive de création

Les écrans de création autonomes (`/properties/new`, `/units/new`,
`/tenants/new`, `/units/bulk`) sont retirés. Les écrans d'**édition**
(`[id]/edit`) sont conservés — modifier reste distinct de créer.

### 3. Un seul chemin d'écriture atomique

`bulk_onboard_portfolio` gagne la création de lieu inline (nouvelle signature
`(p_property jsonb, p_rows jsonb)`, migration `20260715190000`). Aucun chemin
d'écriture parallèle : la création du lieu, du logement, de l'occupant et du
bail vit dans une seule transaction. L'ancienne signature `(uuid, jsonb)` est
supprimée dans la même migration (leçon surcharges ambiguës).

## Règles

- **Le bail reste la clé de voûte.** Rien ne dérive une échéance hors du bail.
- **Atomicité tout-ou-rien.** Une erreur annule lieu + logement + occupant + bail.
- **Pré-remplissage non destructif** (ADR-016) : le loyer/jour par défaut du
  logement pré-remplit, ne fait pas autorité.
- **Édition préservée.** Les écrans `[id]/edit` restent le chemin de correction.

## Conséquences

- Onboarding en un écran, un submit, échéances immédiates → relances armées.
- Surface réduite (quatre écrans de création retirés) — objectif minimaliste.
- welcome-flow.md passe en v1.3 : étape 8 = « créer un bail ».
- Réécriture du parcours e2e d'onboarding ; retrait des tests des écrans supprimés.

## Liens

Étend ADR-016 (loyer par défaut + onboarding combiné). Repose sur ADR-004
(génération des échéances). domain-model.md inchangé (hiérarchie conservée).
