// Vue « impayés & soldes » du dashboard (ADR-023 §8, phase Nouvelle lecture).
// Pur, sans I/O : alimenté par la vue lease_balances (grand livre) jointe aux
// baux du propriétaire. Une ligne par BAIL — le compte courant consolide ce
// que le locataire doit, là où l'ancienne liste montrait une ligne par
// échéance (un même locataire pouvait apparaître plusieurs fois).
//
// Dérivation : la vue expose l'impayé (échu) et le solde certain, pas le
// « pas encore exigible ». dû total = max(0, −certain_balance) ; attendu =
// dû total − impayé (≥ 0 par construction : l'impayé est un sous-ensemble
// exigible du dû). Une avance (solde certain positif) donne dû total = 0.

import type { Lease } from "@/lib/leases/types"
import type { LeaseBalance } from "./types"

export type LeaseDebtRow = {
  leaseId: string
  tenantId: string
  unitId: string
  /** Impayé : dû certain exigible aujourd'hui (échu). */
  overdue: number
  /** Dû certain pas encore exigible (loyer du mois à venir). */
  expected: number
  /** Dû certain total = overdue + expected. */
  outstanding: number
  /** Débits affirmés en attente de validation locataire (charges variables). */
  pendingDebits: number
  /** Crédits affirmés à confirmer (brouillons, déclarations locataire). */
  pendingCredits: number
  /** Montants en litige (débits + crédits contestés), jamais fusionnés au reste. */
  disputed: number
}

export type LedgerOverview = {
  /** Σ impayés certains, tous baux — « qui est en retard et de combien ». */
  totalOverdue: number
  /** Σ crédits en attente de confirmation. */
  totalPendingCredits: number
  /** Σ montants en litige. */
  totalDisputed: number
  /** Baux actifs sans dû, sans attente, sans litige. */
  upToDateCount: number
  /** Une ligne par bail ayant quelque chose à montrer, impayé d'abord. */
  rows: LeaseDebtRow[]
}

export function buildLedgerOverview(
  balances: LeaseBalance[],
  leases: Lease[],
): LedgerOverview {
  const byLease = new Map(balances.map((b) => [b.lease_id, b]))

  let totalOverdue = 0
  let totalPendingCredits = 0
  let totalDisputed = 0
  let upToDateCount = 0
  const rows: LeaseDebtRow[] = []

  for (const lease of leases) {
    const b = byLease.get(lease.id)
    if (!b) continue

    const overdue = b.overdue_amount
    const outstanding = Math.max(0, -b.certain_balance)
    const expected = Math.max(0, outstanding - overdue)
    const pendingDebits = b.pending_debits
    const pendingCredits = b.pending_credits
    const disputed = b.disputed_debits + b.disputed_credits

    totalOverdue += overdue
    totalPendingCredits += pendingCredits
    totalDisputed += disputed

    if (outstanding > 0 || pendingDebits > 0 || pendingCredits > 0 || disputed > 0) {
      rows.push({
        leaseId: lease.id,
        tenantId: lease.tenant_id,
        unitId: lease.unit_id,
        overdue,
        expected,
        outstanding,
        pendingDebits,
        pendingCredits,
        disputed,
      })
    } else if (lease.status === "active") {
      upToDateCount += 1
    }
  }

  // Impayé d'abord (montant décroissant), puis dû total, puis à confirmer.
  rows.sort(
    (a, c) =>
      c.overdue - a.overdue || c.outstanding - a.outstanding || c.pendingCredits - a.pendingCredits,
  )

  return { totalOverdue, totalPendingCredits, totalDisputed, upToDateCount, rows }
}

// Sous-ligne d'un bail dans « À encaisser » : chaque nature présente est
// nommée, aucune n'est fusionnée dans une autre (ADR-023 §6) — « en retard »
// ne recouvre jamais silencieusement l'« attendu ».
export function describeLeaseDebtRow(row: LeaseDebtRow): string {
  const parts: string[] = []
  if (row.overdue > 0) parts.push("en retard")
  if (row.expected > 0) parts.push("attendu")
  if (row.pendingDebits > 0) parts.push("charge en attente")
  if (row.pendingCredits > 0) parts.push("déclaration à confirmer")
  if (row.disputed > 0) parts.push("en litige")
  return parts.join(" · ")
}

// Impayé du grand livre par bail — la clé de la garde compte courant des
// relances (ADR-023) : même règle dans la projection UI et la file opérateur.
export function overdueByLease(balances: LeaseBalance[]): Map<string, number> {
  return new Map(balances.map((b) => [b.lease_id, b.overdue_amount]))
}

export type LeaseDebtAmount = {
  amount: number
  /** Pilote la couleur : retard (destructive), dû (foreground), attente (muted), litige (warning). */
  tone: "overdue" | "due" | "pending" | "disputed"
}

// Montant porté par la ligne. Le chiffre rouge est l'IMPAYÉ seul, jamais le
// dû total : la somme des lignes rouges recolle avec la tuile « Retard »
// (le complément « attendu » est nommé dans la sous-ligne, et le détail vit
// sur la fiche bail). Un montant en simple attente n'est pas une dette :
// ton muted. Une ligne de litige seul porte le montant contesté, pas 0.
export function leaseDebtRowAmount(row: LeaseDebtRow): LeaseDebtAmount {
  if (row.overdue > 0) return { amount: row.overdue, tone: "overdue" }
  if (row.outstanding > 0) return { amount: row.outstanding, tone: "due" }
  if (row.pendingCredits > 0) return { amount: row.pendingCredits, tone: "pending" }
  if (row.pendingDebits > 0) return { amount: row.pendingDebits, tone: "pending" }
  return { amount: row.disputed, tone: "disputed" }
}
