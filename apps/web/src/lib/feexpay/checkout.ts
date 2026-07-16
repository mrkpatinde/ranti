// ADR-019 — Cash-in FeexPay : le locataire paie le montant PLEIN du loyer.
// Zéro surcharge locataire (les frais PSP sont absorbés par la commission
// Ranti). Le `lease_id` est posé dans les métadonnées et relu au webhook pour
// l'idempotence + le match exact (ADR-018 : amount == monthly_rent_amount).
//
// ⚠️ SQUELETTE — endpoint et noms de champs à CONFIRMER sur le sandbox FeexPay
// (docs.feexpay.me). Isolés dans CHECKOUT_PATH / le body ci-dessous : le
// branchement réel = ajuster ces constantes puis rejouer contre le sandbox.

import { getFeexpayConfig } from "./config"
import { feexpayRequest, normalizeStatus } from "./http"
import type { FeexpayCheckoutInput, FeexpayCheckoutResult } from "./types"

// ⚠️ Chemin provisoire (API publique connue). À confirmer sandbox.
const CHECKOUT_PATH = "/api/transactions/public/requestpayment"

/**
 * Crée une transaction de checkout FeexPay pour un loyer. Renvoie `null` si le
 * rail n'est pas configuré (gate BCEAO / env absent) — l'appelant retombe alors
 * sur le filet (alias PI-SPI, ADR-009), jamais sur un demi-appel.
 */
export async function createFeexpayCheckout(
  input: FeexpayCheckoutInput,
): Promise<FeexpayCheckoutResult | null> {
  const config = getFeexpayConfig()
  if (!config) return null

  // ⚠️ Forme du body à CONFIRMER sur le sandbox. Le lease_id voyage dans les
  // métadonnées (callback_info) et revient tel quel au webhook.
  const raw = await feexpayRequest(config, CHECKOUT_PATH, {
    method: "POST",
    body: {
      shop: config.shopId,
      amount: input.amount,
      phoneNumber: input.payerPhone,
      description: input.description ?? "Loyer Ranti",
      callback_url: config.callbackUrl,
      callback_info: { lease_id: input.leaseId },
    },
  })

  const reference =
    (typeof raw.reference === "string" && raw.reference) ||
    (typeof raw.transaction_id === "string" && raw.transaction_id) ||
    null
  if (!reference) {
    // Une réponse sans référence = on ne peut ni suivre ni rapprocher : échec.
    return null
  }

  const checkoutUrl =
    typeof raw.payment_url === "string"
      ? raw.payment_url
      : typeof raw.url === "string"
        ? raw.url
        : null

  return {
    reference,
    checkoutUrl,
    status: normalizeStatus(raw.status),
    raw,
  }
}
