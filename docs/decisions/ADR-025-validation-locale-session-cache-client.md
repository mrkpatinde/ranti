# ADR-025 — Validation locale de la session et cache client de navigation

## Statut

Accepté — 2026-07-19 (perf/nav-streaming-cache, PR #187). Documente une posture
de sécurité durable introduite pour la fluidité de navigation.

## Contexte

La navigation entre écrans était lente en perçu. Deux causes serveur :

1. **Le proxy validait la session en réseau à chaque navigation.** `updateSession`
   (middleware Supabase) appelait `getUser()`, un aller-retour HTTP au serveur
   Auth, sérialisé avant tout rendu. Sur réseau terrain (cible : propriétaires
   au Bénin), +150 à +500 ms morts par clic. Les gardes de page utilisaient déjà
   `getClaims()` (vérification locale du JWT) — le proxy était le retardataire.
2. **Aucun cache de navigation client.** Le défaut Next 15+ pour une page
   dynamique est `staleTimes.dynamic = 0` : revenir sur un onglet vu 3 s plus tôt
   refait tout le rendu serveur.

## Décision

1. **Proxy : `getUser()` → `getClaims()`.** Le JWT du projet est signé en **ES256**
   (asymétrique) ; `getClaims()` vérifie la signature **localement** contre le
   JWKS (mis en cache 10 min côté `auth-js`), sans réseau. Un jeton legacy HS256
   retombe silencieusement sur `getUser()` (comportement d'avant). Le patron
   canonique `@supabase/ssr` est respecté au refresh (cookies écrits sur la
   requête, réponse reconstruite), verrouillé par un test de contrat.

2. **Cache client `staleTimes.dynamic = 30`.** Revenir sur un onglet visité il y
   a moins de 30 s réutilise le rendu en cache, sans requête. Chaque server
   action d'écriture d'argent purge l'ensemble des surfaces via
   `revalidateMoneySurfaces()` (`lib/cache/money.ts`), qui applique un
   `revalidatePath("/", "layout")` unique. C'est le seul levier dont la doc Next
   garantit qu'il purge aussi le cache CLIENT : une liste de `revalidatePath` par
   chemin ne purge que les caches serveur, et le rafraîchissement client observé
   vient d'un effet global aux Server Actions annoncé comme temporaire.

3. **`jwt_expiry = 900` (15 min).** Voir Conséquences.

## Conséquences

### Latence de révocation (le compromis)

Les jetons d'accès Supabase sont des JWT **apatrides** : valides jusqu'à leur
`exp`, non révocables individuellement (design JWT standard, pas un choix Ranti).
Avant ce changement, le `getUser()` du proxy était le **seul** point du parcours
qui interrogeait le serveur Auth ; il détectait une session révoquée côté serveur
(« se déconnecter partout », `signOut` global) et purgeait les cookies à la
**navigation suivante** (quelques secondes).

Avec la validation locale, une session révoquée reste utilisable jusqu'au
**prochain rafraîchissement du jeton d'accès**, borné par `jwt_expiry`. À
l'expiration, le refresh réseau rejette un refresh token révoqué et la session
meurt. La fenêtre d'exposition passe donc de « navigation suivante » à « ≤ TTL ».

**Mitigation retenue : `jwt_expiry` abaissé à 15 min.** Rétrécit la fenêtre d'un
facteur 4 sans coût par navigation (le refresh n'a lieu qu'à l'expiration, pas à
chaque clic — bien moins cher que l'ancien `getUser()` par navigation).

**Rayon de souffle accepté.** Ranti est **non-custodial** (ADR-024) : un jeton
volé ne peut pas déplacer d'argent. Le pire cas sur ≤ 15 min est une atteinte à
la confidentialité (PII locataire) ou à l'intégrité (faux encaissements,
quittances) — **réversible** (encaissements et quittances annulables). Compromis
proportionné tant que Ranti reste non-custodial. **À revisiter** si le rail
custodial FeexPay (gelé, ADR-019) revient : la fenêtre deviendrait une question
d'argent, et une revalidation serveur périodique (getUser toutes les N minutes,
gardée par un cookie horodaté) serait alors préférable.

### Fraîcheur des données (cache 30 s)

Les écritures **externes à la session** (webhook FeexPay, actions locataire côté
public, envois ranti-ops) et les **autres onglets** de la même session ne peuvent
pas purger le cache du navigateur du propriétaire : ces surfaces peuvent afficher
des données jusqu'à 30 s périmées, contre un refetch systématique avant. Borne
assumée, documentée dans `next.config.ts`.

## Suivi

- **PROD** : régler `jwt_expiry` à 900 s dans le dashboard Supabase (Auth →
  Sessions). `config.toml` ne pilote que le stack local.
- Gap distinct (non traité ici) : un reset de mot de passe ne révoque pas les
  autres sessions par défaut chez Supabase ; seul un « se déconnecter partout »
  explicite le fait.
- `createBail` (onboarding) et `recordPaymentFirstRun` (FirstRun) écrivent de
  l'argent sans passer par `revalidateMoneySurfaces()` — raccordement à faire.
