import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryError } from "@/lib/supabase/query-error"

const { limit, order, select, from } = vi.hoisted(() => {
  const limit = vi.fn()
  const order = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ order })
  const from = vi.fn().mockReturnValue({ select })
  return { limit, order, select, from }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from }),
}))

import { listPaymentTransactions } from "../queries"

describe("listPaymentTransactions (lecture ledger sous RLS)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    order.mockReturnValue({ limit })
    select.mockReturnValue({ order })
    from.mockReturnValue({ select })
  })

  it("retourne les lignes triées du plus récent au plus ancien, bornées à 200", async () => {
    const rows = [{ id: "tx-2" }, { id: "tx-1" }]
    limit.mockResolvedValue({ data: rows, error: null })

    const result = await listPaymentTransactions()

    expect(result).toEqual(rows)
    expect(from).toHaveBeenCalledWith("payment_transactions")
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(limit).toHaveBeenCalledWith(200)
  })

  it("data null (aucune ligne) : tableau vide, jamais null", async () => {
    limit.mockResolvedValue({ data: null, error: null })
    expect(await listPaymentTransactions()).toEqual([])
  })

  it("erreur DB : QueryError levée, jamais avalée en liste vide", async () => {
    limit.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    })
    await expect(listPaymentTransactions()).rejects.toBeInstanceOf(QueryError)
  })
})
