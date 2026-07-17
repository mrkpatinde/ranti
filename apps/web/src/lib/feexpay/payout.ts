// ADR-019 — Payout FeexPay : reversement du NET (95 %) au propriétaire, vers le
// rail de réception qu'il a défini (MTN MoMo, Moov Money, Celtiis Cash).
//
// FeexPay V2 : le payout démarre `PENDING` puis se résout de façon asynchrone
// → `getFeexpayPayoutStatus` sert au polling ops. `merchantReference` rend
// l'appel idempotent côté FeexPay (anti double-reversement).
//
// ⚠️ SQUELETTE — endpoints et champs à CONFIRMER sur le sandbox FeexPay, et
// activation PROD gatée BCEAO (ADR-019 : payout = point de bascule juridique).
// Ne pas câbler à un déclencheur automatique tant que le gate n'est pas levé —
// le reversement reste une action ops (statut `paid_out`, ADR-018).

import { getFeexpayConfig } from "./config"
import { feexpayRequest, normalizeStatus } from "./http"
import type {
  FeexpayPayoutInput,
  FeexpayPayoutResult,
  FeexpayStatusResult,
} from "./types"

// ⚠️ Chemins provisoires (API publique connue). À confirmer sandbox.
const PAYOUT_PATH = "/api/payouts/public/create"
const STATUS_PATH = "/api/transactions/public/single/status"

/**
 * Déclenche un payout du net vers le propriétaire. Renvoie `null` si le rail
 * n'est pas configuré. Le statut renvoyé est généralement `PENDING` (V2) :
 * confirmer ensuite via getFeexpayPayoutStatus avant de basculer `paid_out`.
 */
export async function requestFeexpayPayout(
  input: FeexpayPayoutInput,
): Promise<FeexpayPayoutResult | null> {
  const config = getFeexpayConfig()
  if (!config) return null

  // ⚠️ Forme du body à CONFIRMER sur le sandbox.
  const raw = await feexpayRequest(config, PAYOUT_PATH, {
    method: "POST",
    body: {
      shop: config.shopId,
      amount: input.amount,
      network: input.network,
      phoneNumber: input.recipientPhone,
      // Idempotence côté PSP : rejouer un même payout ne double pas le virement.
      reference: input.merchantReference,
    },
  })

  const reference =
    (typeof raw.reference === "string" && raw.reference) ||
    (typeof raw.transaction_id === "string" && raw.transaction_id) ||
    input.merchantReference

  return {
    reference,
    status: normalizeStatus(raw.status),
    raw,
  }
}

/**
 * Polling du statut d'une transaction FeexPay (payout V2 PENDING → résolu, ou
 * vérification d'un cash-in). Renvoie `null` si le rail n'est pas configuré.
 */
export async function getFeexpayPayoutStatus(
  reference: string,
): Promise<FeexpayStatusResult | null> {
  const config = getFeexpayConfig()
  if (!config) return null

  const raw = await feexpayRequest(
    config,
    `${STATUS_PATH}/${encodeURIComponent(reference)}`,
    { method: "GET" },
  )

  return {
    reference,
    status: normalizeStatus(raw.status),
    raw,
  }
}
