import { describe, expect, it } from "vitest"
import { buildDashboardSummary } from "../summary"
import type { RentDueBalance } from "@/lib/rent-dues/types"

const REF = new Date(2026, 6, 15) // 2026-07-15 (mois local)

function due(overrides: Partial<RentDueBalance>): RentDueBalance {
  return {
    id: "d",
    landlord_id: "l",
    lease_id: "lease",
    unit_id: "unit",
    tenant_id: "tenant",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    due_date: "2026-07-05",
    amount_due: 50000,
    amount_paid: 0,
    currency: "XOF",
    status: "expected",
    cancelled_reason: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...overrides,
  } as RentDueBalance
}

describe("buildDashboardSummary", () => {
  it("échéance du mois soldée → à jour, payé, hors owed", () => {
    const s = buildDashboardSummary([due({ amount_paid: 50000, due_date: "2026-07-05" })], REF)
    expect(s.upToDateCount).toBe(1)
    expect(s.paid).toBe(50000)
    expect(s.owed).toHaveLength(0)
  })

  it("échéance du mois à venir non payée → attendu + owed(non retard)", () => {
    const s = buildDashboardSummary([due({ due_date: "2026-07-20" })], REF)
    expect(s.expected).toBe(50000)
    expect(s.overdue).toBe(0)
    expect(s.owed).toEqual([expect.objectContaining({ remaining: 50000, late: false })])
  })

  it("échéance passée non payée → retard + owed(retard)", () => {
    const s = buildDashboardSummary([due({ due_date: "2026-06-05" })], REF)
    expect(s.overdue).toBe(50000)
    expect(s.expected).toBe(0)
    expect(s.owed[0]?.late).toBe(true)
  })

  it("paiement partiel → restant dans owed", () => {
    const s = buildDashboardSummary([due({ due_date: "2026-07-05", amount_paid: 20000 })], REF)
    expect(s.owed[0]?.remaining).toBe(30000)
    expect(s.overdue).toBe(30000)
  })

  it("taux de recouvrement du mois : floor(payé / dû du mois), borné 0–100", () => {
    // Deux échéances du mois : 50000 (payé 20000) + 50000 (payé 0) = 20000/100000.
    const s = buildDashboardSummary(
      [
        due({ id: "a", due_date: "2026-07-05", amount_paid: 20000 }),
        due({ id: "b", due_date: "2026-07-20", amount_paid: 0 }),
      ],
      REF,
    )
    expect(s.monthDue).toBe(100000)
    expect(s.collectionRate).toBe(20)
  })

  it("recouvrement complet du mois → 100 ; floor n'arrondit pas à 100 s'il reste dû", () => {
    expect(
      buildDashboardSummary([due({ due_date: "2026-07-05", amount_paid: 50000 })], REF).collectionRate,
    ).toBe(100)
    // 49999/50000 = 99,998 % → floor 99 (jamais « 100 % » tant qu'il reste 1 FCFA).
    expect(
      buildDashboardSummary([due({ due_date: "2026-07-05", amount_paid: 49999 })], REF).collectionRate,
    ).toBe(99)
  })

  it("aucune échéance du mois (que du retard d'un autre mois) → collectionRate null", () => {
    const s = buildDashboardSummary([due({ due_date: "2026-06-05" })], REF)
    expect(s.monthDue).toBe(0)
    expect(s.collectionRate).toBeNull()
  })

  it("annulée → ignorée ; retard trié en tête", () => {
    const s = buildDashboardSummary(
      [
        due({ id: "a", status: "cancelled" }),
        due({ id: "b", due_date: "2026-07-25" }),
        due({ id: "c", due_date: "2026-06-05" }),
      ],
      REF,
    )
    expect(s.owed.map((o) => o.dueId)).toEqual(["c", "b"])
  })
})
