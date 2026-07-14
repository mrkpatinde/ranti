import { describe, expect, it } from "vitest"
import { normalizeKkiapayPayload } from "../validation"

describe("normalizeKkiapayPayload", () => {
  const LEASE = "b6666666-6666-6666-6666-666666666666"
  const valid = {
    transactionId: "KKP-001",
    amount: 60000,
    status: "SUCCESS",
    stateData: { lease_id: LEASE },
  }

  it("normalise une charge utile valide", () => {
    expect(normalizeKkiapayPayload(valid)).toEqual({
      reference: "KKP-001",
      leaseId: LEASE,
      amount: 60000,
      providerStatus: "SUCCESS",
      payload: valid,
    })
  })

  it("tolère les clés alternatives reference / state", () => {
    const alt = { reference: "KKP-002", amount: "60000", state: { lease_id: LEASE } }
    const n = normalizeKkiapayPayload(alt)
    expect(n?.reference).toBe("KKP-002")
    expect(n?.amount).toBe(60000)
    expect(n?.providerStatus).toBe("UNKNOWN")
  })

  it("accepte un lease_id UUID en majuscules (regex insensible à la casse)", () => {
    const upper = { ...valid, stateData: { lease_id: LEASE.toUpperCase() } }
    expect(normalizeKkiapayPayload(upper)?.leaseId).toBe(LEASE.toUpperCase())
  })

  it("status non-string ou absent → UNKNOWN (jamais un crash)", () => {
    expect(normalizeKkiapayPayload({ ...valid, status: 42 })?.providerStatus).toBe("UNKNOWN")
    const noStatus: Record<string, unknown> = { ...valid }
    delete noStatus.status
    expect(normalizeKkiapayPayload(noStatus)?.providerStatus).toBe("UNKNOWN")
  })

  it("refuse les montants négatifs ou non numériques (y compris en chaîne)", () => {
    expect(normalizeKkiapayPayload({ ...valid, amount: -60000 })).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, amount: "abc" })).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, amount: "-1" })).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, amount: null })).toBeNull()
  })

  it("refuse les formes malformées", () => {
    expect(normalizeKkiapayPayload(null)).toBeNull()
    expect(normalizeKkiapayPayload("string")).toBeNull()
    expect(normalizeKkiapayPayload([])).toBeNull()
    expect(normalizeKkiapayPayload({})).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, amount: 0 })).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, amount: 1.5 })).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, transactionId: " " })).toBeNull()
    expect(normalizeKkiapayPayload({ ...valid, stateData: {} })).toBeNull()
    expect(
      normalizeKkiapayPayload({ ...valid, stateData: { lease_id: "pas-un-uuid" } }),
    ).toBeNull()
  })
})
