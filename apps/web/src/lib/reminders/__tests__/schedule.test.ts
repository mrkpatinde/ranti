import { describe, expect, it } from "vitest"
import { computeUpcomingReminders } from "../schedule"
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
    due_date: "2026-07-25",
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

describe("computeUpcomingReminders", () => {
  it("échéance à venir → prochaine fenêtre J-5 à due-5", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-25" })], REF)
    expect(r).toEqual([
      expect.objectContaining({ label: "Rappel J-5", date: "2026-07-20", late: false }),
    ])
  })

  it("échéance demain → prochaine = la veille (aujourd'hui)", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-16" })], REF)
    expect(r[0]).toMatchObject({ label: "Rappel la veille", date: "2026-07-15", late: false })
  })

  it("échéance passée non soldée → prochaine fenêtre de retard (J+10)", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-10" })], REF)
    expect(r[0]).toMatchObject({ label: "Relance J+10", date: "2026-07-20", late: true })
  })

  it("cadence épuisée (au-delà de J+10) → exclue", () => {
    expect(computeUpcomingReminders([due({ due_date: "2026-07-01" })], REF)).toEqual([])
  })

  it("échéance soldée ou annulée → exclue", () => {
    expect(
      computeUpcomingReminders(
        [
          due({ id: "paid", due_date: "2026-07-25", amount_paid: 50000 }),
          due({ id: "cancelled", due_date: "2026-07-25", status: "cancelled" }),
        ],
        REF,
      ),
    ).toEqual([])
  })

  it("tri par date croissante (la plus proche d'abord)", () => {
    const r = computeUpcomingReminders(
      [
        due({ id: "far", due_date: "2026-08-10" }), // J-5 le 08-05
        due({ id: "soon", due_date: "2026-07-16" }), // veille le 07-15
      ],
      REF,
    )
    expect(r.map((x) => x.dueId)).toEqual(["soon", "far"])
  })
})
