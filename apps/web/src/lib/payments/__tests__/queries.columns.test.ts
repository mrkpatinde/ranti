import { beforeEach, describe, expect, it, vi } from "vitest"

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

// v4 (All-Inclusive 5 %) : le SELECT est verrouillé par des grants PAR COLONNE
// (migration all_inclusive_5pct). La liste de colonnes du client est donc
// load-bearing : une colonne de la vision comptabilité (ou un « * ») ferait
// échouer la requête en permission denied côté authenticated. Ce test fige
// la parité entre la liste TS et le grant SQL.
describe("listPaymentTransactions — colonnes = vision reçu uniquement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    order.mockReturnValue({ limit })
    select.mockReturnValue({ order })
    from.mockReturnValue({ select })
  })

  it("sélectionne exactement les colonnes accordées à authenticated", async () => {
    limit.mockResolvedValue({ data: [], error: null })
    await listPaymentTransactions()

    expect(select).toHaveBeenCalledTimes(1)
    const columns = (select.mock.calls[0][0] as string).split(",").map((c) => c.trim())
    expect(columns.sort()).toEqual(
      [
        "id",
        "landlord_id",
        "lease_id",
        "provider",
        "provider_reference",
        "amount_received",
        "service_fee_bp",
        "service_fee",
        "net_amount",
        "currency",
        "status",
        "rejection_reason",
        "rent_reception_id",
        "created_at",
        "verified_at",
        "paid_out_at",
      ].sort(),
    )
  })

  it("ne demande jamais la vision comptabilité (coûts PSP, marge) ni un « * »", async () => {
    limit.mockResolvedValue({ data: [], error: null })
    await listPaymentTransactions()

    const selection = select.mock.calls[0][0] as string
    expect(selection).not.toContain("*")
    for (const forbidden of [
      "payin_cost_bp",
      "payout_cost_bp",
      "payin_cost",
      "payout_cost",
      "net_margin",
      "psp_fee",
      "platform_fee",
      "payload",
    ]) {
      expect(selection).not.toContain(forbidden)
    }
  })
})
