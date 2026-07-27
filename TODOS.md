# TODOS

## Paiements (ADR-018)

### Valider juridiquement le montage PSP (BCEAO)
**Priority:** P0
Détention transitoire de fonds via wallet marchand PSP = potentiellement
établissement de paiement (Instruction BCEAO 001-01-2024, art. 4/9/11/30).
Piste privilégiée : partenariat/externalisation art. 7 avec le PSP agréé.
**Bloquant avant toute activation production** — voir caveat ADR-018.
Trancher aussi le **montage wallet** (unique Ranti vs sous-comptes par
propriétaire) : ADR-021 montre qu'il porte à la fois la conformité BCEAO et le
nom marchand affiché au locataire sur le reçu PSP — prérequis de la copie
`/confirmer` (reco : sous-comptes).

### Ouvrir le compte sandbox FeexPay et rejouer un webhook signé réel
**Priority:** P1
PSP retenu = **FeexPay** (ADR-019, cash-in unique). Le squelette client est en
place (`src/lib/feexpay/` : `config`, `signature`, `checkout`, `payout` +
polling V2, `normalize`, `http`) et le webhook `POST /api/payments/notification`
est câblé sur le rail FeexPay. Action CEO : créer le compte test sur feexpay.me.
Ensuite, contre le vrai sandbox (chacun isolé, « fix une ligne ») :
- confirmer la base URL et les chemins checkout/payout/status
  (`src/lib/feexpay/checkout.ts`, `payout.ts`) ;
- confirmer les noms de champs du body et de la charge webhook
  (`src/lib/feexpay/normalize.ts`) ;
- confirmer le nom d'en-tête de signature (`FEEXPAY_SIGNATURE_HEADER` dans
  `src/lib/feexpay/signature.ts`, défaut `x-feexpay-signature`) ;
- rejouer idempotence + mauvaise signature contre le sandbox.
Env : `FEEXPAY_ENV=sandbox`, `FEEXPAY_API_KEY`, `FEEXPAY_SHOP_ID`,
`FEEXPAY_WEBHOOK_SECRET`, `FEEXPAY_CALLBACK_URL`.

### Surface produit : carte de validation + vue transactions
**Priority:** P2
Le server action `verifyPaymentTransaction` et `listPaymentTransactions()`
sont prêts (src/lib/payments/) ; il manque la carte de validation dans
`/collections` et une vue ledger propriétaire.

### Modéliser la fiscalité dans le ledger (TVA/TPS)
**Priority:** P2
Après avis de l'expert-comptable (TVA 18 % si CA > 50 M FCFA, régime TPS
probable au démarrage) : ajouter un taux `tax_bp` par ligne, même pattern que
les autres taux — petite migration. Décision fiscale = prérequis, pas le code.

### Rate-limiting du webhook
**Priority:** P3
`POST /api/payments/notification` n'a pas de rate-limiting applicatif
(chaque requête coûte un HMAC). Gated par la signature ; à traiter au niveau
Vercel Firewall ou middleware si le volume le justifie.

## FirstRun (prise en main)

### Couvrir la création complète d'un bail en E2E
**Priority:** P2
Les E2E authentifiés existent depuis v0.3.39.0 (auth locale + bailleur par
spec via l'en-tête `x-ranti-local-auth-user`). Ce qui reste : dérouler la
CRÉATION d'un bail de bout en bout (formulaire → échéance → paiement →
quittance) plutôt que de partir d'un bail semé. Attention, l'ancienne note
« l'auth Google empêche un login automatisé » était FAUSSE — elle a bloqué ce
chantier plusieurs semaines pour rien.

### generate_receipt_core : idempotence sous verrou
**Priority:** P3
Le check « receipt déjà émis » précède `pg_advisory_xact_lock` : deux appels
concurrents pour la même réception font échouer le second sur la contrainte
unique (erreur transitoire inoffensive, « Réessayez »). Déplacer le check
après le verrou dans une future migration de la fonction.

### Centraliser les libellés logement
**Priority:** P3
`UNIT_TYPE_OPTIONS` existe en 4 copies (bail-form, units/edit, first-run
modals…). Exporter depuis `lib/units` et consommer partout. (La moitié
paiement/type de document est faite en v0.3.36.0 : `lib/receipts/labels.ts`
consommé par PDF, page locataire, page reçu propriétaire et /verifier.)

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

## Performance

### Paginer ou segmenter la liste des encaissements
**Priority:** P3
`getLandlordCollections` et `getLandlordReceipts` sont sans borne et
`/collections` rend une carte par ligne : le coût croît avec l'historique
(~12 réceptions/an/bail) et le rendu complet est retenu 30 s dans le cache
client. La promesse produit (« chaque encaissement reste ici ») interdit un
simple `.limit()` : segmenter par mois ou paginer en gardant les brouillons
toujours visibles (draftCount et confirmation en dépendent).

## Completed

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
