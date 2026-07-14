import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryError } from "@/lib/supabase/query-error"

const { order, select, from } = vi.hoisted(() => {
  const order = vi.fn()
  const select = vi.fn().mockReturnValue({ order })
  const from = vi.fn().mockReturnValue({ select })
  return { order, select, from }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from }),
}))

import { listPaymentTransactions } from "../queries"

describe("listPaymentTransactions (lecture ledger sous RLS)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    select.mockReturnValue({ order })
    from.mockReturnValue({ select })
  })

  it("retourne les lignes triées du plus récent au plus ancien", async () => {
    const rows = [{ id: "tx-2" }, { id: "tx-1" }]
    order.mockResolvedValue({ data: rows, error: null })

    const result = await listPaymentTransactions()

    expect(result).toEqual(rows)
    expect(from).toHaveBeenCalledWith("payment_transactions")
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false })
  })

  it("data null (aucune ligne) : tableau vide, jamais null", async () => {
    order.mockResolvedValue({ data: null, error: null })
    expect(await listPaymentTransactions()).toEqual([])
  })

  it("erreur DB : QueryError levée, jamais avalée en liste vide", async () => {
    order.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    })
    await expect(listPaymentTransactions()).rejects.toBeInstanceOf(QueryError)
  })
})
