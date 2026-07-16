// ADR-019 — Configuration du client FeexPay (rail d'encaissement UNIQUE).
//
// Tout ce qui parle à FeexPay vit dans ce dossier (même règle d'isolation que
// src/lib/kkiapay) ; la logique de calcul/cycle de vie reste dans
// src/lib/payments. Ce module ne fait qu'assembler la config depuis l'env,
// SERVEUR UNIQUEMENT (clé API + secret webhook = jamais côté client).
//
// ⚠️ Activation production gatée BCEAO (ADR-019) : tant que le gate n'est pas
// levé, `FEEXPAY_ENV` reste `sandbox`. Aucune valeur par défaut ne pointe vers
// la prod — une config absente renvoie `null` (le rail ne s'active pas tout
// seul), miroir de createAdminClient().

/** Bascule sandbox / live. Défaut prudent : sandbox. */
export type FeexpayEnv = "sandbox" | "live"

export interface FeexpayConfig {
  env: FeexpayEnv
  /** Base URL de l'API FeexPay (dérivée de `env`). */
  baseUrl: string
  /** Clé API marchand (Authorization: Bearer). Serveur uniquement. */
  apiKey: string
  /** Identifiant de la boutique/marchand FeexPay (posé sur chaque requête). */
  shopId: string
  /** URL de callback (webhook) enregistrée côté FeexPay pour ce marchand. */
  callbackUrl: string | null
}

// ⚠️ Domaines à CONFIRMER sur docs.feexpay.me au branchement sandbox
// (isolé ici : fix une ligne). Placeholder d'après l'API publique connue.
const BASE_URL: Record<FeexpayEnv, string> = {
  sandbox: "https://api.feexpay.me",
  live: "https://api.feexpay.me",
}

function readEnv(): FeexpayEnv {
  return process.env.FEEXPAY_ENV === "live" ? "live" : "sandbox"
}

/**
 * Assemble la config FeexPay depuis l'env. Renvoie `null` si l'un des secrets
 * requis manque : l'appelant (checkout/payout) doit alors renoncer proprement
 * plutôt que d'émettre un appel à moitié configuré.
 */
export function getFeexpayConfig(): FeexpayConfig | null {
  const apiKey = process.env.FEEXPAY_API_KEY
  const shopId = process.env.FEEXPAY_SHOP_ID

  if (!apiKey || !shopId) return null

  const env = readEnv()
  return {
    env,
    baseUrl: BASE_URL[env],
    apiKey,
    shopId,
    callbackUrl: process.env.FEEXPAY_CALLBACK_URL || null,
  }
}
