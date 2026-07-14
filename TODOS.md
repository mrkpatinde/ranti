# TODOS

## Paiements (ADR-018)

### Valider juridiquement le montage PSP (BCEAO)
**Priority:** P0
Détention transitoire de fonds via wallet marchand PSP = potentiellement
établissement de paiement (Instruction BCEAO 001-01-2024, art. 4/9/11/30).
Piste privilégiée : partenariat/externalisation art. 7 avec le PSP agréé.
**Bloquant avant toute activation production** — voir caveat ADR-018.

### Ouvrir le compte sandbox FedaPay et rejouer un webhook signé réel
**Priority:** P1
Action CEO : créer le compte test sur fedapay.com. Ensuite : brancher le
client API (`src/lib/fedapay/` : checkout, payout `POST /v1/payouts`),
confirmer le nom d'en-tête de signature webhook (isolé dans
`src/lib/kkiapay/signature.ts`, fix une ligne), rejouer idempotence +
mauvaise signature contre le vrai sandbox.

### Surface produit : carte de validation + vue transactions
**Priority:** P2
Le server action `verifyPaymentTransaction` et `listPaymentTransactions()`
sont prêts (src/lib/payments/) ; il manque la carte de validation dans
`/collections` et une vue ledger propriétaire.

### Rate-limiting du webhook
**Priority:** P3
`POST /api/payments/notification` n'a pas de rate-limiting applicatif
(chaque requête coûte un HMAC). Gated par la signature ; à traiter au niveau
Vercel Firewall ou middleware si le volume le justifie.

## Completed
