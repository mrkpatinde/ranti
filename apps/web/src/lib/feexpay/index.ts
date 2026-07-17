// ADR-019 — Client FeexPay (rail d'encaissement UNIQUE), isolé du domaine
// payments. Tout ce qui parle à FeexPay vit ici : config, signature webhook,
// checkout (cash-in plein montant), payout (net 95 %, polling V2) et
// normalisation de la charge utile webhook.
//
// ⚠️ Squelette : endpoints, noms de champs et en-tête de signature à confirmer
// contre le sandbox FeexPay ; activation production gatée BCEAO (voir ADR-019).

export { getFeexpayConfig } from "./config"
export type { FeexpayConfig, FeexpayEnv } from "./config"

export { FEEXPAY_SIGNATURE_HEADER, verifyFeexpaySignature } from "./signature"

export { normalizeFeexpayPayload } from "./normalize"

export { createFeexpayCheckout } from "./checkout"
export {
  requestFeexpayPayout,
  getFeexpayPayoutStatus,
} from "./payout"

export type {
  FeexpayCheckoutInput,
  FeexpayCheckoutResult,
  FeexpayNetwork,
  FeexpayPayoutInput,
  FeexpayPayoutResult,
  FeexpayStatusResult,
  FeexpayTransactionStatus,
  NormalizedFeexpayEvent,
} from "./types"
