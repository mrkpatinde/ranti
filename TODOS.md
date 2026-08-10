# TODOS

État au 2026-08-10, après le rebase du pivot entreprises de gestion
(ADR-029) et du retrait du rail de paiement (ADR-030) sur les évolutions
v0.3.37.0 → v0.3.41.0.

## Grand livre

### Terminer la bascule : phase « contract » d'ADR-023
**Priority:** P1
La migration `20260716150000` a introduit `public.transactions` en phase
« expand », alimenté par trois triggers miroirs depuis le modèle historique
(`rent_dues` / `rent_receptions` / `rent_reception_allocations`). La phase
« contract » n'a jamais eu lieu : les deux modèles coexistent, et le tableau de
bord interroge les deux sur la même page. Chaque écriture d'argent est écrite
deux fois, et un écart entre les deux modèles produit un solde affiché faux.

La migration `20260809120400` a rendu cet écart observable, pas résolu :
`private.check_ledger_health()` tourne chaque nuit à 03h10 UTC et archive son
verdict dans `private.ledger_health` (vue `public.ops_ledger_health`).

Séquence : (1) laisser tourner le contrôle un mois complet et vérifier que
`diverging_leases` reste à 0 ; (2) basculer les lectures du tableau de bord et
de la fiche bail sur `transactions` et `lease_balances` ; (3) retirer les
triggers miroirs, le backfill et la colonne `legacy_ref`.

## Compte et accès

### Partage d'un compte entre les employés d'une agence
**Priority:** P1
Un compte égale un portefeuille (ADR-029). Deux personnes d'une même agence
partagent aujourd'hui un identifiant Google ou travaillent sur deux
portefeuilles disjoints. C'est le premier point de friction attendu chez une
agence structurée.

Chantier : table de membres, résolution de `private.current_landlord_id()` à
plusieurs comptes auth, matrice de droits (qui encaisse, qui clôture, qui
exporte), et audit qui distingue l'auteur du compte. Volontairement remis à
plus tard : aucun des 35 jeux de policies RLS actuels ne le prévoit.

Déclencheur : première agence à plus de deux personnes sur le même
portefeuille.

## Quittance

### Certification locataire : l'identité du cliqueur n'est pas prouvée
**Priority:** P2
Limite documentée en tête de la migration `20260809120300` et dans ADR-013 §4.
Le locataire n'a pas de compte : il reçoit un lien que le gestionnaire lui
transmet. Un gestionnaire déterminé peut donc récupérer ce lien et cliquer à la
place de son locataire.

Ce que le sceau prouve aujourd'hui : qu'un document n'a pas été altéré après
certification, et que la certification est passée par le parcours à jeton. Ce
qu'il ne prouve pas : qui a cliqué.

Rendre l'usurpation impossible suppose un code à usage unique envoyé au numéro
du locataire. C'est un arbitrage produit entre friction et valeur probante, à
trancher, pas un correctif technique. La journalisation de la délivrance du
lien (`receipt.share_link_issued` dans `audit_logs`) rend au moins la manœuvre
traçable : un sceau apposé sans qu'aucun lien n'ait été demandé pour cette
quittance est une anomalie repérable.

### generate_receipt_core : idempotence sous verrou
**Priority:** P3
Le check « quittance déjà émise » précède `pg_advisory_xact_lock` : deux appels
concurrents pour la même réception font échouer le second sur la contrainte
unique (erreur transitoire inoffensive, « Réessayez »). Déplacer le check après
le verrou dans une future migration de la fonction.

## Base de données

### Retirer les vestiges d'énumération du rail supprimé
**Priority:** P3
`rent_receptions.recorded_by` accepte encore `'psp'` (contrainte posée par
`20260714120000`) et `transactions.source` accepte encore `'feexpay'`
(contrainte posée par `20260716150000`). Ces valeurs n'ont plus aucun écrivain
depuis ADR-029. Retrait par migration de contrainte, après vérification qu'aucune
ligne existante ne les porte.

### Objets dormants du grand livre
**Priority:** P3
Restent en base sans écrivain depuis ADR-026 puis `20260809120100` : la colonne
`transactions.tenant_token`, les types `reparation` / `frais` de la contrainte
`type`, et les colonnes `pending_debits` / `disputed_debits` de la vue
`lease_balances` (valeur 0). À traiter avec la phase « contract ».

### Surveiller la dérive base ↔ migrations
**Priority:** P2
La migration `20260809120200` a réparé deux dérives introduites par de la DDL
appliquée hors migration : RLS jamais activée sur `reminders` et
`reminder_events`, privilèges `DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER`
accordés à `authenticated` sur `receipts` en production.

`public.ops_grant_drift` doit rester vide. Reste à faire : intégrer sa lecture
à un contrôle périodique plutôt qu'à une vérification manuelle.

## Vérification publique (/verifier)

### Rate limit + retrait de `status` sur verify_receipt_by_number
**Priority:** P2
Références séquentielles énumérables, RPC anonyme appelable en direct via
PostgREST : risque résiduel accepté au ship v0.3.36.0 (le retour ne contient
plus ni empreintes, ni tenant_ack, ni montants). Quand le trafic le justifie :
règle Vercel WAF sur /verifier. Au prochain recreate : retirer `status` du
retour (jamais rendu, `integrity` porte déjà l'annulation).

### E2E des chemins RPC de la recherche par référence
**Priority:** P2
Verdict unique / ambigu / introuvable validés à la main contre la prod au
ship v0.3.36.0, mais aucun E2E ne les rejoue (les specs actuelles s'arrêtent
au refus de format, sans base). Piste : fixture seedée ou référence
bien formée inexistante (RNT-1900-0001) pour le chemin « introuvable ».

### Trancher le cache hors-ligne de /recu
**Priority:** P3
`/verifier` est désormais exclu du cache PWA (fail closed), mais la page
locataire `/recu/[token]` (nominative, montants) reste cachable sur appareil
partagé. Si c'est une fonctionnalité (relire sa quittance hors réseau), le
documenter ; sinon l'exclure aussi.

## Portefeuille et clôture

### Modèle d'honoraires plus fin
**Priority:** P2
`owners.fee_rate_bp` porte un taux unique par mandant. Le terrain dira si un
taux par lot, un forfait mensuel ou un minimum de facturation sont nécessaires.
À ne pas anticiper avant d'avoir la réponse de trois agences.

### Reprise d'un portefeuille depuis un logiciel existant
**Priority:** P3
L'import accepte un fichier converti en JSON par l'application
(`src/lib/import/`). Une agence qui vient d'un logiciel de gestion aura un export
d'une autre forme, et parfois un historique d'encaissements à reprendre. Non
couvert : l'import crée des baux et leurs échéances, pas des encaissements
passés.

## Tests

### E2E authentifié pour les parcours agence
**Priority:** P2
`/import`, `/cloture` et `/reminders/batch` n'ont pas d'E2E. L'auth locale des
specs existe depuis v0.3.39.0 (bailleur par spec via l'en-tête
`x-ranti-local-auth-user`) : le chantier est d'écrire les parcours, pas de
débloquer l'authentification.

### Couvrir la création complète d'un bail en E2E
**Priority:** P2
Les E2E authentifiés existent depuis v0.3.39.0 (auth locale + bailleur par
spec via l'en-tête `x-ranti-local-auth-user`). Ce qui reste : dérouler la
CRÉATION d'un bail de bout en bout (formulaire → échéance → paiement →
quittance) plutôt que de partir d'un bail semé. Attention, l'ancienne note
« l'auth Google empêche un login automatisé » était FAUSSE — elle a bloqué ce
chantier plusieurs semaines pour rien.

## Performance

### Paginer ou segmenter la liste des encaissements
**Priority:** P2
`getLandlordCollections` et `getLandlordReceipts` sont sans borne et
`/collections` rend une carte par ligne. Sur un portefeuille de deux logements
le coût était théorique ; sur soixante lots (≈ 720 encaissements par an) il ne
l'est plus. La promesse produit interdit un simple `.limit()` : segmenter par
mois ou paginer en gardant les brouillons toujours visibles (`draftCount` et la
confirmation en dépendent).

### Borner la génération des relevés
**Priority:** P3
`src/lib/statements/queries.ts` lance les relevés par vagues plutôt qu'en une
fois. Vérifier le comportement au-delà de vingt mandants avant d'ouvrir un
export de masse.

## Divers

### Centraliser les libellés lot/paiement
**Priority:** P3
`UNIT_TYPE_OPTIONS` existe en plusieurs copies (bail-form, units/edit, import…)
et les libellés de méthode de paiement en deux. Exporter depuis `lib/units` /
`lib/receipts` et consommer partout.

### Collision de numéro ADR-006
**Priority:** P3
Deux ADR portent le numéro 006 (relances automatiques, audit des mutations
sensibles). Des commentaires `.sql` référencent les deux. Non renumérotée.

## Completed

### Retrait du rail de paiement
**Priority:** P0
Tables `payment_transactions` et `payment_proofs`, RPC du rail,
`src/lib/feexpay/`, `src/lib/payments/`, `src/app/api/payments/`. La validation
juridique du montage PSP (BCEAO), le compte sandbox FeexPay, la surface de
validation, la fiscalité du ledger et le rate-limiting du webhook n'ont plus
d'objet.
**Completed:** 2026-08-09 (ADR-030, migration `20260809120000`)

### Suppression du parcours dupliqué /first-run
**Priority:** P1
`src/app/first-run/` dupliquait le rail « Premiers pas » du tableau de bord et
repartait d'un état vide au rechargement. Le rail du tableau de bord, dérivé
des données réelles, reste le seul chemin de prise en main. Les deux entrées de
suivi qui s'y rapportaient (hydratation de la progression, E2E `/first-run`)
tombent avec lui.
**Completed:** 2026-08-09 (ADR-029)

### Faire tourner les E2E en CI
**Priority:** P2
Les 20 parcours authentifiés ne protégeaient que celui qui les lançait à la
main : le job `db` ne démarre que Postgres, alors qu'ils exigent la pile
complète. Job `e2e` ajouté — pile réduite (db, auth, rest, kong), identifiants
dérivés de `supabase status` plutôt que figés, rapport Playwright et journaux
des services conservés en cas d'échec.
**Completed:** v0.3.40.0 (2026-07-27)

### E2E authentifiés débloqués + isolation par bailleur
**Priority:** P2
Le blocage supposé (auth Google) n'existait pas : `RANTI_LOCAL_AUTH` était déjà
en place et déjà posé dans `playwright.config.ts`. Manquaient (1)
`SUPABASE_JWT_SECRET`, sans quoi aucune session n'était forgée et la RLS
bloquait toute lecture — les specs « authentifiées » ne pouvaient vérifier que
des redirections ; (2) la ligne `auth.users` de l'utilisateur local, dont
l'absence faisait échouer toute création de profil sur la clé étrangère ;
(3) un bailleur par spec. Corrigé au passage : la config visait la base de
PRODUCTION par défaut. 20 E2E, aucun ignoré.
**Completed:** v0.3.39.0 (2026-07-27)

### Ambiguïté des références RNT levée par le nom du propriétaire
**Priority:** P1
La prod portait deux `RNT-2026-0001` : la recherche par référence renvoyait
« plusieurs documents portent cette référence » sur le numéro le plus courant.
Second critère de recherche (nom du bailleur) plutôt qu'un discriminant dans la
référence imprimée — un changement de format n'aurait soigné que les documents
futurs. Le nom est un filtre d'ENTRÉE : le retour ne gagne aucun champ, un test
verrouille qu'il ne fuit jamais. Champ affiché seulement après verdict ambigu.
Migration `20260727180000`, test `verify_receipt_by_number_landlord.test.sql`
(7 cas, scénario exact de la prod).
**Completed:** v0.3.38.0 (2026-07-27)

### Hydrater la progression FirstRun depuis les données
**Priority:** P1
Rechargement de `/first-run` = écran vide + risque de doublon. La distinction
principal/ajouté est désormais persistée (`leases.created_during_onboarding`)
plutôt que devinée : « le plus ancien est le principal » devient faux dès que ce
bail est archivé. Écran semé depuis la base (`getFirstRunSeed`) ; si un bail
principal existe, l'étape `setup` — le formulaire vide, soit l'invitation exacte
au doublon — est reprise en `lease`. Migration `20260727180010`.
**Completed:** v0.3.38.0 (2026-07-27)

### Page locataire : panne ≠ document inexistant
**Priority:** P0
`/recu/[token]` et son PDF renvoyaient `notFound()` / 404 aussi bien pour un
token inconnu que pour une panne RPC. Le locataire — sans compte, sans retry,
sans support — lisait « introuvable » sur la quittance qu'il venait de recevoir.
Les trois surfaces sœurs faisaient déjà la distinction. PDF : 503 + Retry-After,
pour qu'aucun cache ne fige un « introuvable » sur un document réel.
**Completed:** v0.3.38.0 (2026-07-27)

### setOnboardingStatus : échec d'écriture avalé
**Priority:** P1
Statut « terminé » perdu en silence = rail « Premiers pas » de retour à chaque
visite, sans explication ni sortie. L'action renvoie son résultat, le composant
réessaie une fois et ne rafraîchit que si l'écriture a abouti.
**Completed:** v0.3.38.0 (2026-07-27)

### Réglage de relance : l'échec d'écriture ne peut plus être avalé
**Priority:** P1
`setReminderSettings` renvoyait `void` et journalisait l'échec DB dans un
`console.error` ; l'appelant (`reminder-settings.tsx`) faisait
`void setReminderSettings(...)` avec état optimiste. Un bailleur pouvait donc
voir « Désactivée » sur un réglage **jamais écrit en base** — sur des messages
envoyés en son nom. L'action renvoie désormais
`{ ok: true } | { ok: false; error }`, l'écran revient à l'état précédent et
affiche l'échec (`role="alert"`), et aucune surface n'est revalidée quand rien
n'a changé en base. Le test qui verrouillait l'ancien comportement
(`resolves.toBeUndefined()`, « jamais propagée ») est inversé.
Libellé corrigé au passage : l'écran disait « Ranti relance vos locataires » /
« Désactivée : vous relancez vous-même », laissant croire que l'interrupteur
coupe les envois. Il dit maintenant « Préférence enregistrée » — vrai, puisque
la file d'envoi (ranti-ops, ADR-022) ne lit pas encore ces colonnes.
**Completed:** v0.3.37.0 (2026-07-27)

### Sceller l'empreinte à l'émission + recette SHA-256 unique
**Priority:** P1
`sha256_fingerprint` n'était écrite qu'à la certification locataire : toute
quittance neuve sortait `unsealed` sur `/verifier` (« aucune empreinte
d'intégrité n'y est scellée ») — le levier de vérification publique était
éteint par défaut. Le sceau est désormais posé dans l'INSERT de
`private.generate_receipt_core` (`issued_at` figé explicitement pour entrer
dans le calcul ; pas d'UPDATE post-insert, qui doublerait la ligne d'audit).
`certify_receipt_by_token` ne réécrit plus un sceau existant (`coalesce`) et
redevient la seule deuxième voix. La recette, jusque-là copiée-collée dans 3
fonctions vivantes, est extraite en `private.receipt_computed_fingerprint()`
(schéma `private` : pas d'endpoint PostgREST inutile), appelée par les quatre
chemins. Rétro-scellement des documents antérieurs isolé dans une migration
séparée, retirable. Migrations `20260727120000` + `20260727120010`, test
`supabase/tests/receipt_sealed_at_issue.test.sql`.
**Completed:** v0.3.37.0 (2026-07-27), appliqué en prod le jour même. Contrôle avant/après
sur les 6 reçus de production : verdicts inchangés (5 `verified`, 1 `cancelled`,
0 `tampered`), 0 reçu non scellé restant. Le seul reçu rétro-scellé était
`cancelled` — statut qui prime sur le sceau, donc aucun verdict affiché modifié.

### Étendre le streaming Suspense aux pages Relances et Encaissements
**Priority:** P2
`/reminders` (vague de 9 requêtes) et `/collections` (4 requêtes) bloquaient
la navigation sur leur `Promise.all` sans zone Suspense. Structure cadre
statique + zone streamée appliquée (même patron que `/dashboard` et
`/leases/[id]`), squelettes par segment au gabarit exact en plus.
**Completed:** v0.3.33.0 (2026-07-19)
