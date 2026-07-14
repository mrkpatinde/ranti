import { describe, expect, it } from "vitest"
import { FEE_RATES_BP, calculatePayout } from "../fees"
import { PaymentError } from "../types"

describe("calculatePayout (ADR-018 v3 : 1,8 % PSP + 1,2 % Ranti, floor, net par soustraction)", () => {
  it("100 000 FCFA → PSP 1 800, Ranti 1 200, reversement 97 000", () => {
    expect(calculatePayout(100_000)).toEqual({
      grossAmount: 100_000,
      pspFee: 1_800,
      platformFee: 1_200,
      netPayout: 97_000,
      pspFeeBp: 180,
      platformFeeBp: 120,
    })
  })

  it("50 000 FCFA → 900 / 600 / 48 500", () => {
    const p = calculatePayout(50_000)
    expect(p.pspFee).toBe(900)
    expect(p.platformFee).toBe(600)
    expect(p.netPayout).toBe(48_500)
  })

  it("6 667 FCFA → floor par composant : 120 / 80, net 6 467", () => {
    const p = calculatePayout(6_667)
    expect(p.pspFee).toBe(120)
    expect(p.platformFee).toBe(80)
    expect(p.netPayout).toBe(6_467)
  })

  it("33 FCFA → frais 0 / 0, net 33 (floor sous le franc)", () => {
    const p = calculatePayout(33)
    expect(p.pspFee).toBe(0)
    expect(p.platformFee).toBe(0)
    expect(p.netPayout).toBe(33)
  })

  it("taux configurables : contrat PSP différent = un objet rates", () => {
    const p = calculatePayout(10_000, { psp: 170, platform: 130 })
    expect(p.pspFee).toBe(170)
    expect(p.platformFee).toBe(130)
    expect(p.netPayout).toBe(9_700)
  })

  it("invariant : pspFee + platformFee + netPayout === grossAmount (balayage)", () => {
    for (let amount = 1; amount <= 5_000; amount++) {
      const p = calculatePayout(amount)
      expect(p.pspFee + p.platformFee + p.netPayout).toBe(amount)
    }
    for (const amount of [25_000, 33_333, 99_999, 250_000, 1_000_001, 123_456_789]) {
      const p = calculatePayout(amount)
      expect(p.pspFee + p.platformFee + p.netPayout).toBe(amount)
    }
  })

  it("le total des frais ne dépasse jamais 3,0 %", () => {
    for (const amount of [1, 33, 6_667, 50_000, 100_000, 999_999]) {
      const p = calculatePayout(amount)
      expect(p.pspFee + p.platformFee).toBeLessThanOrEqual((amount * 300) / 10000)
    }
  })

  it("rejette 0, négatif, non-entier, NaN, Infinity", () => {
    for (const bad of [0, -1, -50_000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculatePayout(bad)).toThrowError(PaymentError)
      try {
        calculatePayout(bad)
      } catch (e) {
        expect((e as PaymentError).code).toBe("amount_invalid")
      }
    }
  })

  it("rejette des taux invalides", () => {
    expect(() => calculatePayout(1_000, { psp: -1, platform: 120 })).toThrowError(PaymentError)
    expect(() => calculatePayout(1_000, { psp: 180.5, platform: 120 })).toThrowError(PaymentError)
  })

  it("taux par défaut = 180 bp PSP + 120 bp Ranti", () => {
    expect(FEE_RATES_BP).toEqual({ psp: 180, platform: 120 })
  })
})
