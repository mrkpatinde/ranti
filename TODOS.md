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

### Hydrater la progression FirstRun depuis les données
**Priority:** P1
Un bailleur `guided`/`exploring` qui recharge `/first-run` revoit un état vide
(le reducer repart de zéro) alors que son bail existe déjà : risque de
re-création (doublon de lieu si typo) et checklist mensongère. Dériver l'étape
et les cartes des vraies données (`getOnboardingProgress`, baux/échéances),
comme le fait déjà `/dashboard`. Suivi de la revue adversariale 2026-07-18
(F4) ; les réglages de relance sont déjà semés depuis la base.

**Blocage identifié le 2026-07-27** (raison pour laquelle ce n'est PAS une
simple requête) : l'état FirstRun distingue `lease` (le bail « principal » du
parcours guidé, type `PrimaryLease`) de `addedLeases` (les suivants, type
`Lease[]`). **Rien en base ne marque lequel était le principal** — ni colonne,
ni ordre fiable après édition. Hydrater exige donc de trancher d'abord :
(a) considérer le plus ancien bail comme principal, (b) persister un marqueur
d'onboarding, ou (c) supprimer la distinction principal/ajouté du reducer.
C'est une décision de modélisation, pas un branchement de requête — d'où le
report hors du ship du 2026-07-27.

### E2E authentifié pour /first-run et /recu
**Priority:** P2
Le parcours guidé (welcome → bail → paiement → quittance) et la page locataire
n'ont pas d'E2E : l'auth Google seule (ADR-010) empêche un login automatisé.
Piste : session Playwright pré-fabriquée (storageState avec cookies Supabase
d'un compte de test) ou un bypass d'auth réservé au mode test. Gaps notés
« intentionally uncovered » au ship v0.3.29.0.

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

### Ambiguïté par conception des numéros bas — DÉJÀ EFFECTIVE EN PROD
**Priority:** P1
La séquence RNT repart à 0001 par propriétaire et par année. Ce n'est plus une
projection : **la prod porte deux `RNT-2026-0001`** (un par bailleur), plus deux
`R-000001` hérités. La recherche par référence sur `/verifier` renvoie donc
**déjà** « plusieurs documents portent cette référence » pour le numéro le plus
susceptible d'être présenté par un locataire (constaté le 2026-07-27, 2 bailleurs
et 6 quittances en base). Décision produit à trancher : discriminant dans la
référence imprimée (initiales, somme de contrôle), second champ de recherche
(nom du bailleur), ou assumer le renvoi vers lien/QR.
Note : le chemin QR (`/verifier/[id]`, UUID) n'est pas touché — seule la
recherche par numéro l'est.

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
