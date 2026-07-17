import { describe, expect, it, vi } from "vitest"
import type { PaymentsRepository } from "../repository"
import { processPayment } from "../service"
import { PaymentError } from "../types"

const INPUT = {
  leaseId: "b6666666-6666-6666-6666-666666666666",
  amountReceived: 60_000,
  provider: "feexpay",
  reference: "FXP-001",
  payload: { src: "test" },
}

function makeRepo(overrides: Partial<PaymentsRepository> = {}): PaymentsRepository {
  return {
    ingestNotification: vi.fn().mockResolvedValue({
      transactionId: "tx-1",
      status: "pending",
      created: true,
    }),
    ...overrides,
  }
}

describe("processPayment (ADR-018 v2 : le webhook ingère seulement)", () => {
  it("chemin nominal : ingestion → pending (validation propriétaire à venir)", async () => {
    const repo = makeRepo()
    const result = await processPayment(repo, INPUT)

    expect(result).toEqual({ outcome: "pending", transactionId: "tx-1" })
    expect(repo.ingestNotification).toHaveBeenCalledWith({
      provider: "feexpay",
      reference: "FXP-001",
      leaseId: INPUT.leaseId,
      amount: 60_000,
      payload: { src: "test" },
    })
  })

  it("montant inattendu : ingest renvoie rejected", async () => {
    const repo = makeRepo({
      ingestNotification: vi.fn().mockResolvedValue({
        transactionId: "tx-2",
        status: "rejected",
        created: true,
      }),
    })
    const result = await processPayment(repo, INPUT)

    expect(result).toEqual({ outcome: "rejected", transactionId: "tx-2" })
  })

  it("replay webhook : duplicate, rien n'est retouché (idempotence)", async () => {
    const repo = makeRepo({
      ingestNotification: vi.fn().mockResolvedValue({
        transactionId: "tx-1",
        status: "verified",
        created: false,
      }),
    })
    const result = await processPayment(repo, INPUT)

    expect(result).toEqual({
      outcome: "duplicate",
      transactionId: "tx-1",
      status: "verified",
    })
  })

  it("statut inattendu sur une ligne fraîche : erreur technique", async () => {
    const repo = makeRepo({
      ingestNotification: vi.fn().mockResolvedValue({
        transactionId: "tx-3",
        status: "paid_out",
        created: true,
      }),
    })

    await expect(processPayment(repo, INPUT)).rejects.toMatchObject({
      name: "PaymentError",
      code: "technical",
    })
  })

  it("PaymentError du repository remonte telle quelle", async () => {
    const repo = makeRepo({
      ingestNotification: vi.fn().mockRejectedValue(new PaymentError("lease_not_found")),
    })

    await expect(processPayment(repo, INPUT)).rejects.toMatchObject({
      name: "PaymentError",
      code: "lease_not_found",
    })
  })
})
