# TODOS

## Paiements (ADR-018)

### Valider juridiquement le montage PSP (BCEAO)
**Priority:** P0
Détention transitoire de fonds via wallet marchand PSP = potentiellement
établissement de paiement (Instruction BCEAO 001-01-2024, art. 4/9/11/30).
Piste privilégiée : partenariat/externalisation art. 7 avec le PSP agréé.
**Bloquant avant toute activation production** — voir caveat ADR-018.

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

## Completed
