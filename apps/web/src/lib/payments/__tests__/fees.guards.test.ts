import { describe, expect, it } from "vitest"
import { calculateTransactionDetails } from "../fees"
import { PaymentError } from "../types"

// Complète fees.test.ts : chaque disjonction de la garde de taux (payin,
// payout, NaN) et le bord « taux zéro » — mêmes règles que la RPC SQL
// private.compute_transaction_details (bp >= 0, entiers uniquement).
describe("calculateTransactionDetails — gardes de taux (branches restantes)", () => {
  it("rejette un payin négatif avec le code amount_invalid", () => {
    try {
      calculateTransactionDetails(100_000, { service: 500, payin: -1, payout: 100 })
      expect.unreachable("payin négatif accepté")
    } catch (e) {
      expect(e).toBeInstanceOf(PaymentError)
      expect((e as PaymentError).code).toBe("amount_invalid")
    }
  })

  it("rejette un payout négatif avec le code amount_invalid", () => {
    try {
      calculateTransactionDetails(100_000, { service: 500, payin: 170, payout: -1 })
      expect.unreachable("payout négatif accepté")
    } catch (e) {
      expect(e).toBeInstanceOf(PaymentError)
      expect((e as PaymentError).code).toBe("amount_invalid")
    }
  })

  it("rejette un service > 10000 bp (net négatif : troncature SQL ≠ Math.floor)", () => {
    try {
      calculateTransactionDetails(100_000, { service: 10_001, payin: 170, payout: 100 })
      expect.unreachable("service > 100 % accepté")
    } catch (e) {
      expect(e).toBeInstanceOf(PaymentError)
      expect((e as PaymentError).code).toBe("amount_invalid")
    }
  })

  it("accepte service = 10000 bp exactement (net 0, floor et troncature confondus)", () => {
    const d = calculateTransactionDetails(100_000, { service: 10_000, payin: 170, payout: 100 })
    expect(d.rantiServiceFee).toBe(100_000)
    expect(d.netToLandlord).toBe(0)
    expect(d.payoutCost).toBe(0)
  })

  it("rejette un payin non entier", () => {
    expect(() =>
      calculateTransactionDetails(100_000, { service: 500, payin: 170.5, payout: 100 }),
    ).toThrowError(PaymentError)
  })

  it("rejette un payout non entier", () => {
    expect(() =>
      calculateTransactionDetails(100_000, { service: 500, payin: 170, payout: 99.9 }),
    ).toThrowError(PaymentError)
  })

  it("rejette des taux NaN et Infinity", () => {
    expect(() =>
      calculateTransactionDetails(100_000, { service: Number.NaN, payin: 170, payout: 100 }),
    ).toThrowError(PaymentError)
    expect(() =>
      calculateTransactionDetails(100_000, {
        service: 500,
        payin: Number.POSITIVE_INFINITY,
        payout: 100,
      }),
    ).toThrowError(PaymentError)
  })

  it("taux zéro partout : accepté (bp >= 0), tout à zéro, net = brut", () => {
    const d = calculateTransactionDetails(100_000, { service: 0, payin: 0, payout: 0 })
    expect(d.rantiServiceFee).toBe(0)
    expect(d.netToLandlord).toBe(100_000)
    expect(d.payinCost).toBe(0)
    expect(d.payoutCost).toBe(0)
    expect(d.netRantiMargin).toBe(0)
  })
})
