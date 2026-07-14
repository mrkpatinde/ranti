import { describe, expect, it } from "vitest"
import { paymentErrorCodeFromMessage, paymentErrorMessage } from "../errors"
import type { PaymentErrorCode } from "../types"

// Complète repository.test.ts (qui balaie les codes littéraux) : ici les
// correspondances NON identitaires et les retombées.
describe("paymentErrorCodeFromMessage — correspondances non triviales", () => {
  it("amount_mismatch (raison SQL) → payment_amount_mismatch (code domaine)", () => {
    expect(paymentErrorCodeFromMessage("P0001: amount_mismatch")).toBe(
      "payment_amount_mismatch",
    )
    // La variante déjà préfixée est reconnue par la même substring.
    expect(paymentErrorCodeFromMessage("payment_amount_mismatch")).toBe(
      "payment_amount_mismatch",
    )
  })

  it("les codes purement TS (signature, frais) ne sont PAS mappés : technical", () => {
    // Ces codes naissent dans la couche route/fees, jamais dans un message RPC.
    expect(paymentErrorCodeFromMessage("signature_invalid")).toBe("technical")
    expect(paymentErrorCodeFromMessage("fee_computation_mismatch")).toBe("technical")
  })

  it("message vide → technical", () => {
    expect(paymentErrorCodeFromMessage("")).toBe("technical")
  })
})

describe("paymentErrorMessage — table complète", () => {
  const ALL_CODES: PaymentErrorCode[] = [
    "lease_not_found",
    "lease_not_active",
    "amount_invalid",
    "payment_amount_mismatch",
    "transaction_not_found",
    "transaction_not_pending",
    "provider_invalid",
    "payout_not_applicable",
    "fee_computation_mismatch",
    "signature_invalid",
    "invalid_body",
    "technical",
  ]

  it("chaque code du domaine a un message FR non vide et distinct du code", () => {
    for (const code of ALL_CODES) {
      const msg = paymentErrorMessage(code)
      expect(msg).toBeTruthy()
      expect(msg).not.toBe(code) // jamais le code brut montré à l'utilisateur
    }
  })

  it("code inconnu (défense) : retombe sur le message technique", () => {
    expect(paymentErrorMessage("inconnu" as PaymentErrorCode)).toBe(
      paymentErrorMessage("technical"),
    )
  })
})
