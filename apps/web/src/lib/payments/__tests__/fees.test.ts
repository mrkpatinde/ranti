import { describe, expect, it } from "vitest"
import { TRANSACTION_RATES_BP, calculateTransactionDetails } from "../fees"
import { PaymentError } from "../types"

describe("calculateTransactionDetails (ADR-018 v4 : All-Inclusive 5 %)", () => {
  it("exemple canon CEO — 100 000 : reçu 5 000/95 000, compta 1 700/950/2 350", () => {
    expect(calculateTransactionDetails(100_000)).toEqual({
      grossAmount: 100_000,
      rantiServiceFee: 5_000,
      netToLandlord: 95_000,
      payinCost: 1_700,
      payoutCost: 950,
      netRantiMargin: 2_350,
      serviceFeeBp: 500,
      payinCostBp: 170,
      payoutCostBp: 100,
    })
  })

  it("60 000 : 3 000/57 000 — coûts 1 020 + 570, marge 1 410 (2,35 %)", () => {
    const d = calculateTransactionDetails(60_000)
    expect(d.rantiServiceFee).toBe(3_000)
    expect(d.netToLandlord).toBe(57_000)
    expect(d.payinCost).toBe(1_020)
    expect(d.payoutCost).toBe(570)
    expect(d.netRantiMargin).toBe(1_410)
  })

  it("le payoutCost porte sur le NET reversé, pas sur le brut", () => {
    const d = calculateTransactionDetails(100_000)
    expect(d.payoutCost).toBe(Math.floor((d.netToLandlord * 100) / 10000))
    expect(d.payoutCost).not.toBe(Math.floor((d.grossAmount * 100) / 10000))
  })

  it("floor par composant : 6 667 → 333/6 334, coûts 113 + 63, marge 157", () => {
    const d = calculateTransactionDetails(6_667)
    expect(d.rantiServiceFee).toBe(333)
    expect(d.netToLandlord).toBe(6_334)
    expect(d.payinCost).toBe(113)
    expect(d.payoutCost).toBe(63)
    expect(d.netRantiMargin).toBe(157)
  })

  it("petits montants : 33 → fee 1, marge 1 ; 1 → fee 0, marge 0", () => {
    const d33 = calculateTransactionDetails(33)
    expect(d33.rantiServiceFee).toBe(1)
    expect(d33.netToLandlord).toBe(32)
    expect(d33.netRantiMargin).toBe(1)
    const d1 = calculateTransactionDetails(1)
    expect(d1.rantiServiceFee).toBe(0)
    expect(d1.netToLandlord).toBe(1)
    expect(d1.netRantiMargin).toBe(0)
  })

  it("gros loyer (12M — au-delà de la zone overflow int4 côté SQL)", () => {
    const d = calculateTransactionDetails(12_000_000)
    expect(d.rantiServiceFee).toBe(600_000)
    expect(d.netToLandlord).toBe(11_400_000)
    expect(d.payinCost).toBe(204_000)
    expect(d.payoutCost).toBe(114_000)
    expect(d.netRantiMargin).toBe(282_000)
  })

  it("invariants : reçu balance (fee+net=brut) et marge = fee − coûts (balayage)", () => {
    for (let amount = 1; amount <= 5_000; amount++) {
      const d = calculateTransactionDetails(amount)
      expect(d.rantiServiceFee + d.netToLandlord).toBe(amount)
      expect(d.netRantiMargin).toBe(d.rantiServiceFee - d.payinCost - d.payoutCost)
    }
    for (const amount of [25_000, 33_333, 99_999, 250_000, 1_000_001, 123_456_789]) {
      const d = calculateTransactionDetails(amount)
      expect(d.rantiServiceFee + d.netToLandlord).toBe(amount)
      expect(d.netRantiMargin).toBe(d.rantiServiceFee - d.payinCost - d.payoutCost)
    }
  })

  it("marge négative possible si les coûts dépassent la commission (information, pas erreur)", () => {
    const d = calculateTransactionDetails(100_000, { service: 100, payin: 170, payout: 100 })
    expect(d.netRantiMargin).toBeLessThan(0)
  })

  it("taux configurables : scénario FedaPay (payin 180, payout 0)", () => {
    const d = calculateTransactionDetails(100_000, { service: 500, payin: 180, payout: 0 })
    expect(d.payinCost).toBe(1_800)
    expect(d.payoutCost).toBe(0)
    expect(d.netRantiMargin).toBe(3_200)
  })

  it("rejette 0, négatif, non-entier, NaN, Infinity", () => {
    for (const bad of [0, -1, -50_000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateTransactionDetails(bad)).toThrowError(PaymentError)
      try {
        calculateTransactionDetails(bad)
      } catch (e) {
        expect((e as PaymentError).code).toBe("amount_invalid")
      }
    }
  })

  it("rejette des taux invalides", () => {
    expect(() =>
      calculateTransactionDetails(1_000, { service: -1, payin: 170, payout: 100 }),
    ).toThrowError(PaymentError)
    expect(() =>
      calculateTransactionDetails(1_000, { service: 500.5, payin: 170, payout: 100 }),
    ).toThrowError(PaymentError)
  })

  it("défauts = 500 service / 170 payin / 100 payout", () => {
    expect(TRANSACTION_RATES_BP).toEqual({ service: 500, payin: 170, payout: 100 })
  })
})
