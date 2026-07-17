import { describe, expect, it } from "vitest"
import { normalizeFeexpayPayload } from "../normalize"

const LEASE = "11111111-1111-4111-8111-111111111111"

describe("normalizeFeexpayPayload", () => {
  it("normalise une charge utile valide (callback_info.lease_id)", () => {
    const event = normalizeFeexpayPayload({
      reference: "FXP-001",
      amount: 80000,
      status: "SUCCESSFUL",
      callback_info: { lease_id: LEASE },
    })
    expect(event).toEqual({
      reference: "FXP-001",
      leaseId: LEASE,
      amount: 80000,
      providerStatus: "SUCCESSFUL",
      payload: {
        reference: "FXP-001",
        amount: 80000,
        status: "SUCCESSFUL",
        callback_info: { lease_id: LEASE },
      },
    })
  })

  it("tolère les clés alternatives (transaction_id, metadata, montant string)", () => {
    const event = normalizeFeexpayPayload({
      transaction_id: "FXP-002",
      amount: "95000",
      metadata: { lease_id: LEASE },
    })
    expect(event?.reference).toBe("FXP-002")
    expect(event?.amount).toBe(95000)
    expect(event?.providerStatus).toBe("UNKNOWN")
  })

  it("rejette une forme invalide (non-objet, bail manquant/malformé, montant ≤ 0)", () => {
    expect(normalizeFeexpayPayload(null)).toBeNull()
    expect(normalizeFeexpayPayload("x")).toBeNull()
    expect(
      normalizeFeexpayPayload({ reference: "FXP", amount: 80000 }),
    ).toBeNull()
    expect(
      normalizeFeexpayPayload({
        reference: "FXP",
        amount: 80000,
        callback_info: { lease_id: "not-a-uuid" },
      }),
    ).toBeNull()
    expect(
      normalizeFeexpayPayload({
        reference: "FXP",
        amount: 0,
        callback_info: { lease_id: LEASE },
      }),
    ).toBeNull()
  })
})
