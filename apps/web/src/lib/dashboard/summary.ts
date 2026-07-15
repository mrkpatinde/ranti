// Agrégation « qui a payé / qui doit » du dashboard (ADR-020, dashboard-owner).
// Pur, sans I/O : alimenté par la vue rent_due_balances (amount_due +
// amount_paid confirmé). Dates comparées en chaînes YYYY-MM-DD (sûr côté fuseau,
// due_date est un DATE Postgres).
//
// - Retard : toute échéance passée encore due (tous mois confondus).
// - Attendu : échéance du mois en cours, pas encore due, restant > 0.
// - Payé : encaissé sur les échéances du mois en cours.
// - owed : toutes les échéances restant dues, retard d'abord (liste « à encaisser »).

import type { RentDueBalance } from "@/lib/rent-dues/types"

export type OwedLine = {
  dueId: string
  leaseId: string
  unitId: string
  tenantId: string
  remaining: number
  late: boolean
}

export type DashboardSummary = {
  paid: number
  expected: number
  overdue: number
  upToDateCount: number
  owed: OwedLine[]
}

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function ymd(d: Date): string {
  return `${ym(d)}-${String(d.getDate()).padStart(2, "0")}`
}

export function buildDashboardSummary(
  balances: RentDueBalance[],
  ref: Date = new Date(),
): DashboardSummary {
  const refMonth = ym(ref)
  const today = ymd(ref)

  let paid = 0
  let expected = 0
  let overdue = 0
  let upToDateCount = 0
  const owed: OwedLine[] = []

  for (const b of balances) {
    if (b.status === "cancelled") continue

    const remaining = Math.max(0, b.amount_due - b.amount_paid)
    const late = b.due_date < today
    const thisMonth = b.due_date.slice(0, 7) === refMonth

    if (thisMonth) {
      paid += b.amount_paid
      if (remaining === 0) upToDateCount += 1
      else if (!late) expected += remaining
    }

    if (remaining > 0) {
      if (late) overdue += remaining
      owed.push({
        dueId: b.id,
        leaseId: b.lease_id,
        unitId: b.unit_id,
        tenantId: b.tenant_id,
        remaining,
        late,
      })
    }
  }

  // Retard d'abord, puis montant décroissant.
  owed.sort((a, c) => Number(c.late) - Number(a.late) || c.remaining - a.remaining)

  return { paid, expected, overdue, upToDateCount, owed }
}
