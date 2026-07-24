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

### Extraire un helper SQL commun pour l'empreinte SHA-256
**Priority:** P1
La recette (`receipt_number || issued_at UTC || snapshot::text`) est
copiée-collée dans 3 fonctions vivantes (`certify_receipt_by_token`,
`verify_receipt_integrity`, `verify_receipt_by_number`) : toute évolution
manquée dans une copie ferait diverger les verdicts entre le chemin QR et le
chemin référence. Migration dédiée : `public.receipt_computed_fingerprint()`
appelé par les trois. Différé au ship v0.3.36.0 (rayon d'impact = fonctions
de preuve légale, mérite sa propre revue).

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

### Ambiguïté par conception des numéros bas
**Priority:** P2
La séquence RNT repart à 0001 par propriétaire et par année : dès deux
propriétaires actifs, les petits numéros (ceux que tient un locataire type)
tombent sur « plusieurs documents portent cette référence ». Décision produit
à trancher : discriminant dans la référence imprimée (initiales, somme de
contrôle), second champ de recherche, ou assumer le renvoi vers lien/QR.

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

### Étendre le streaming Suspense aux pages Relances et Encaissements
**Priority:** P2
`/reminders` (vague de 9 requêtes) et `/collections` (4 requêtes) bloquaient
la navigation sur leur `Promise.all` sans zone Suspense. Structure cadre
statique + zone streamée appliquée (même patron que `/dashboard` et
`/leases/[id]`), squelettes par segment au gabarit exact en plus.
**Completed:** v0.3.33.0 (2026-07-19)
