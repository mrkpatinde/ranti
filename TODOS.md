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

### Centraliser les libellés logement/paiement
**Priority:** P3
`UNIT_TYPE_OPTIONS` existe en 4 copies (bail-form, units/edit, first-run
modals…) et les libellés de méthode de paiement en 2. Exporter depuis
`lib/units` / `lib/receipts` et consommer partout.

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
