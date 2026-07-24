import { describe, expect, it } from "vitest"
import { REF_PATTERN, formatVerifyDate, kindLabels, STATE_BADGE } from "../_shared"

// Recherche publique par référence (/verifier) : le filtre de format est la
// première barrière avant la RPC verify_receipt_by_number. Le même motif
// existe côté SQL : ces tests fixent le contrat côté client.

describe("REF_PATTERN", () => {
  it("accepte les références RNT valides", () => {
    expect(REF_PATTERN.test("RNT-2026-0001")).toBe(true)
    expect(REF_PATTERN.test("RNT-2026-9999")).toBe(true)
    // Au-delà de 9999 la séquence s'allonge sans troncature (migration
    // receipt_ref_rnt_no_overflow) : le motif doit suivre.
    expect(REF_PATTERN.test("RNT-2026-10000")).toBe(true)
  })

  it("rejette les formats étrangers ou malveillants", () => {
    expect(REF_PATTERN.test("RNT-2026-DEMO")).toBe(false) // page démo, jamais en base
    expect(REF_PATTERN.test("RNT-26-0001")).toBe(false) // année tronquée
    expect(REF_PATTERN.test("RNT-2026-001")).toBe(false) // séquence trop courte
    expect(REF_PATTERN.test("rnt-2026-0001")).toBe(false) // la page passe en majuscules AVANT le test
    expect(REF_PATTERN.test("RNT-2026-0001'; drop table receipts; --")).toBe(false)
    expect(REF_PATTERN.test("")).toBe(false)
    expect(REF_PATTERN.test("QUI-2026-0001")).toBe(false)
  })
})

describe("formatVerifyDate", () => {
  it("rend une date française lisible", () => {
    expect(formatVerifyDate("2026-07-18T10:00:00Z")).toBe("18 juillet 2026")
  })
})

describe("constantes partagées /verifier", () => {
  it("couvre les deux types de document", () => {
    expect(kindLabels.quittance).toBe("Quittance de loyer")
    expect(kindLabels.receipt).toBe("Reçu de paiement")
  })

  it("couvre les quatre états d'intégrité", () => {
    expect(Object.keys(STATE_BADGE).sort()).toEqual([
      "cancelled",
      "tampered",
      "unsealed",
      "verified",
    ])
  })
})
