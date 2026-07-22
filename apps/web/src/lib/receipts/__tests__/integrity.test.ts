import { describe, expect, it } from "vitest"
import { receiptIntegrityVerdict } from "../integrity"

const FP = "a".repeat(64)
const OTHER = "b".repeat(64)

describe("receiptIntegrityVerdict", () => {
  it("annulé prime sur tout, même empreinte identique", () => {
    expect(
      receiptIntegrityVerdict({
        status: "cancelled",
        storedFingerprint: FP,
        computedFingerprint: FP,
      }),
    ).toBe("cancelled")
  })

  it("scellé + empreintes identiques => vérifié", () => {
    expect(
      receiptIntegrityVerdict({
        status: "issued",
        storedFingerprint: FP,
        computedFingerprint: FP,
      }),
    ).toBe("verified")
  })

  it("empreintes divergentes => altéré", () => {
    expect(
      receiptIntegrityVerdict({
        status: "issued",
        storedFingerprint: FP,
        computedFingerprint: OTHER,
      }),
    ).toBe("tampered")
  })

  it("scellé mais recalcul absent => altéré (jamais un faux « vérifié »)", () => {
    expect(
      receiptIntegrityVerdict({
        status: "issued",
        storedFingerprint: FP,
        computedFingerprint: null,
      }),
    ).toBe("tampered")
  })

  it("pas d'empreinte stockée (non certifié) => non scellé", () => {
    expect(
      receiptIntegrityVerdict({
        status: "issued",
        storedFingerprint: null,
        computedFingerprint: FP,
      }),
    ).toBe("unsealed")
  })

  it("empreinte stockée vide (espaces) traitée comme non scellé", () => {
    expect(
      receiptIntegrityVerdict({
        status: "issued",
        storedFingerprint: "   ",
        computedFingerprint: FP,
      }),
    ).toBe("unsealed")
  })
})
