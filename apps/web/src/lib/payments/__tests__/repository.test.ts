import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { paymentErrorCodeFromMessage, paymentErrorMessage } from "../errors"
import { createPaymentsRepository } from "../repository"
import { PaymentError } from "../types"

function fakeClient(rpcResult: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult.data ?? null, error: rpcResult.error ?? null })
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

const INPUT = {
  provider: "fedapay",
  reference: "PSP-001",
  leaseId: "b6666666-6666-6666-6666-666666666666",
  amount: 60_000,
  payload: null,
}

describe("createPaymentsRepository.ingestNotification", () => {
  it("déballe un résultat tableau (RPC returns table)", async () => {
    const { client, rpc } = fakeClient({
      data: [{ transaction_id: "tx-1", status: "pending", created: true }],
    })
    const result = await createPaymentsRepository(client).ingestNotification(INPUT)

    expect(result).toEqual({ transactionId: "tx-1", status: "pending", created: true })
    expect(rpc).toHaveBeenCalledWith("ingest_payment_notification", {
      p_provider: "fedapay",
      p_reference: "PSP-001",
      p_lease_id: INPUT.leaseId,
      p_amount: 60_000,
      p_payload: null,
    })
  })

  it("déballe un résultat scalaire (ligne unique)", async () => {
    const { client } = fakeClient({
      data: { transaction_id: "tx-2", status: "rejected", created: true },
    })
    const result = await createPaymentsRepository(client).ingestNotification(INPUT)
    expect(result.transactionId).toBe("tx-2")
    expect(result.status).toBe("rejected")
  })

  it("résultat vide → PaymentError technical", async () => {
    const { client } = fakeClient({ data: [] })
    await expect(createPaymentsRepository(client).ingestNotification(INPUT)).rejects.toMatchObject(
      { name: "PaymentError", code: "technical" },
    )
  })

  it("erreur RPC → code du domaine par correspondance de message", async () => {
    const { client } = fakeClient({
      error: { message: 'P0002: lease_not_found' },
    })
    await expect(createPaymentsRepository(client).ingestNotification(INPUT)).rejects.toMatchObject(
      { name: "PaymentError", code: "lease_not_found" },
    )
  })

  it("erreur RPC inconnue → technical", async () => {
    const { client } = fakeClient({ error: { message: "connexion perdue" } })
    await expect(createPaymentsRepository(client).ingestNotification(INPUT)).rejects.toMatchObject(
      { code: "technical" },
    )
  })
})

describe("mappers d'erreurs", () => {
  it("chaque code RPC connu est reconnu par substring", () => {
    for (const code of [
      "lease_not_found",
      "lease_not_active",
      "amount_invalid",
      "transaction_not_found",
      "transaction_not_pending",
      "provider_invalid",
      "payout_not_applicable",
      "invalid_body",
    ] as const) {
      expect(paymentErrorCodeFromMessage(`P0001: ${code}`)).toBe(code)
    }
    expect(paymentErrorCodeFromMessage("autre chose")).toBe("technical")
  })

  it("chaque code a un message FR non vide", () => {
    for (const code of [
      "lease_not_found",
      "payment_amount_mismatch",
      "payout_not_applicable",
      "technical",
    ] as const) {
      expect(paymentErrorMessage(code)).toBeTruthy()
    }
  })

  it("PaymentError porte le code et un message par défaut", () => {
    const e = new PaymentError("transaction_not_pending")
    expect(e.code).toBe("transaction_not_pending")
    expect(e.message).toBe("transaction_not_pending")
  })
})
