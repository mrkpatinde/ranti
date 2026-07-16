import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryError } from "@/lib/supabase/query-error"

const { order, eq, select, from } = vi.hoisted(() => {
  const order = vi.fn()
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { order, eq, select, from }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from }),
}))

import { getLandlordLeaseBalances, LEASE_BALANCES_SELECT } from "../queries"

const ROW = {
  lease_id: "lease-1",
  landlord_id: "landlord-1",
  certain_balance: -40000,
  pending_debits: 0,
  pending_credits: 5000,
  disputed_debits: 0,
  disputed_credits: 0,
  overdue_amount: 40000,
}

beforeEach(() => {
  vi.clearAllMocks()
  eq.mockReturnValue({ order })
  select.mockReturnValue({ eq })
  from.mockReturnValue({ select })
})

describe("getLandlordLeaseBalances (vue lease_balances, ADR-023)", () => {
  it("lit la vue avec colonnes explicites, filtre landlord et tri impayé décroissant", async () => {
    order.mockResolvedValue({ data: [ROW], error: null })

    const rows = await getLandlordLeaseBalances("landlord-1")

    expect(from).toHaveBeenCalledWith("lease_balances")
    expect(select).toHaveBeenCalledWith(LEASE_BALANCES_SELECT)
    expect(eq).toHaveBeenCalledWith("landlord_id", "landlord-1")
    expect(order).toHaveBeenCalledWith("overdue_amount", { ascending: false })
    expect(rows).toEqual([ROW])
  })

  it("la parité de colonnes avec la vue SQL est figée (trois nombres jamais fusionnés)", () => {
    expect(LEASE_BALANCES_SELECT.split(", ").sort()).toEqual(
      [
        "certain_balance",
        "disputed_credits",
        "disputed_debits",
        "landlord_id",
        "lease_id",
        "overdue_amount",
        "pending_credits",
        "pending_debits",
      ].sort(),
    )
  })

  it("data null → liste vide, jamais null", async () => {
    order.mockResolvedValue({ data: null, error: null })
    await expect(getLandlordLeaseBalances("landlord-1")).resolves.toEqual([])
  })

  it("une erreur DB/RLS remonte en QueryError, jamais avalée en liste vide", async () => {
    order.mockResolvedValue({ data: null, error: { code: "42501", message: "rls" } })
    await expect(getLandlordLeaseBalances("landlord-1")).rejects.toBeInstanceOf(QueryError)
  })
})
