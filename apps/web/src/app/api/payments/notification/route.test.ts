import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// processPayment est stubé (la vraie logique d'argent vit en base, testée en
// SQL) ; signature et normalisation restent réelles.
vi.mock("@/lib/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments")>()
  return {
    ...actual,
    processPayment: vi.fn().mockResolvedValue({
      outcome: "pending",
      transactionId: "tx-1",
    }),
  }
})

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({ rpc: vi.fn() }),
}))

import { processPayment } from "@/lib/payments"
import { POST } from "./route"

const SECRET = "test-secret"
const LEASE = "b6666666-6666-6666-6666-666666666666"

function makeRequest(body: string, signature?: string): Request {
  return new Request("http://localhost/api/payments/notification", {
    method: "POST",
    headers: signature ? { "x-feexpay-signature": signature } : {},
    body,
  })
}

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex")
}

const VALID_BODY = JSON.stringify({
  reference: "FXP-001",
  amount: 60000,
  status: "SUCCESSFUL",
  callback_info: { lease_id: LEASE },
})

describe("POST /api/payments/notification", () => {
  beforeEach(() => {
    vi.stubEnv("FEEXPAY_WEBHOOK_SECRET", SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("500 si le secret n'est pas configuré", async () => {
    vi.stubEnv("FEEXPAY_WEBHOOK_SECRET", "")
    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(500)
  })

  it("500 si le client service_role n'est pas configuré", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    vi.mocked(createAdminClient).mockReturnValueOnce(null)
    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(500)
    expect(processPayment).not.toHaveBeenCalled()
  })

  it("401 si la signature est absente ou invalide", async () => {
    expect((await POST(makeRequest(VALID_BODY))).status).toBe(401)
    expect((await POST(makeRequest(VALID_BODY, "mauvaise"))).status).toBe(401)
    expect(processPayment).not.toHaveBeenCalled()
  })

  it("400 si le corps est malformé (JSON ou forme)", async () => {
    const notJson = "pas du json"
    expect((await POST(makeRequest(notJson, sign(notJson)))).status).toBe(400)

    const badShape = JSON.stringify({ amount: 60000 })
    expect((await POST(makeRequest(badShape, sign(badShape)))).status).toBe(400)
    expect(processPayment).not.toHaveBeenCalled()
  })

  it("échec PSP explicite → 200 ignoré, aucune ingestion (même en minuscules)", async () => {
    for (const status of ["FAILED", "declined"]) {
      const failed = JSON.stringify({
        reference: `FXP-${status}`,
        amount: 60000,
        status,
        callback_info: { lease_id: LEASE },
      })
      const res = await POST(makeRequest(failed, sign(failed)))
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ok: true, outcome: "ignored" })
    }
    expect(processPayment).not.toHaveBeenCalled()
  })

  it("statut ABSENT → ingéré en pending (politique : le proprio arbitre)", async () => {
    const noStatus = JSON.stringify({
      reference: "FXP-NOSTATUS",
      amount: 60000,
      callback_info: { lease_id: LEASE },
    })
    const res = await POST(makeRequest(noStatus, sign(noStatus)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, outcome: "pending" })
    expect(processPayment).toHaveBeenCalled()
  })

  it("statut INCONNU (vocabulaire imprévu) → ingéré, jamais perdu derrière un 200", async () => {
    const unknown = JSON.stringify({
      reference: "FXP-COMPLETED",
      amount: 60000,
      status: "COMPLETED",
      callback_info: { lease_id: LEASE },
    })
    const res = await POST(makeRequest(unknown, sign(unknown)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, outcome: "pending" })
    expect(processPayment).toHaveBeenCalled()
  })

  it("200 chemin nominal : processPayment appelé avec l'événement normalisé", async () => {
    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, outcome: "pending" })
    expect(processPayment).toHaveBeenCalledWith(expect.anything(), {
      leaseId: LEASE,
      amountReceived: 60000,
      provider: "feexpay",
      reference: "FXP-001",
      payload: expect.any(Object),
    })
  })

  it("200 (pas 500) pour lease_not_found : retenter ne changera rien", async () => {
    const { PaymentError } = await vi.importActual<typeof import("@/lib/payments")>(
      "@/lib/payments",
    )
    vi.mocked(processPayment).mockRejectedValueOnce(new PaymentError("lease_not_found"))

    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: false, error: "lease_not_found" })
  })

  it("500 pour une panne technique : le PSP doit retenter", async () => {
    vi.mocked(processPayment).mockRejectedValueOnce(new Error("db down"))
    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(500)
  })

  it("200 pour rejected : événement traité, réponse SANS détails internes", async () => {
    vi.mocked(processPayment).mockResolvedValueOnce({
      outcome: "rejected",
      transactionId: "tx-r",
    })
    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, outcome: "rejected" })
    expect(body).not.toHaveProperty("transactionId")
  })

  it("200 pour duplicate (replay) : idempotence visible dans la réponse", async () => {
    vi.mocked(processPayment).mockResolvedValueOnce({
      outcome: "duplicate",
      transactionId: "tx-1",
      status: "pending",
    })
    const res = await POST(makeRequest(VALID_BODY, sign(VALID_BODY)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, outcome: "duplicate" })
  })
})
