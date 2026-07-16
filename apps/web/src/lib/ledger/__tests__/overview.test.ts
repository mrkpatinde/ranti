import { describe, expect, it } from "vitest"
import {
  buildLedgerOverview,
  describeLeaseDebtRow,
  leaseDebtRowAmount,
  type LeaseDebtRow,
} from "../overview"
import type { LeaseBalance } from "../types"
import type { Lease } from "@/lib/leases/types"

function lease(id: string, overrides: Partial<Lease> = {}): Lease {
  return {
    id,
    landlord_id: "L1",
    unit_id: `unit-${id}`,
    tenant_id: `tenant-${id}`,
    monthly_rent_amount: 40000,
    currency: "XOF",
    due_day: 5,
    start_date: "2026-05-01",
    end_date: null,
    status: "active",
    contract_storage_path: null,
    notes: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  }
}

function balance(leaseId: string, overrides: Partial<LeaseBalance> = {}): LeaseBalance {
  return {
    lease_id: leaseId,
    landlord_id: "L1",
    certain_balance: 0,
    pending_debits: 0,
    pending_credits: 0,
    disputed_debits: 0,
    disputed_credits: 0,
    overdue_amount: 0,
    ...overrides,
  }
}

describe("buildLedgerOverview (ADR-023 — impayés & soldes par bail)", () => {
  it("consolide le dû par bail : impayé, attendu (dérivé du solde certain), dû total", () => {
    // 2 mois dus (80 000), 1 échu : impayé 40 000, attendu 40 000.
    const o = buildLedgerOverview(
      [balance("a", { certain_balance: -80000, overdue_amount: 40000 })],
      [lease("a")],
    )
    expect(o.rows).toHaveLength(1)
    expect(o.rows[0]).toMatchObject({
      leaseId: "a",
      overdue: 40000,
      expected: 40000,
      outstanding: 80000,
    })
    expect(o.totalOverdue).toBe(40000)
  })

  it("une avance (solde certain positif) ne crée ni dû ni ligne", () => {
    const o = buildLedgerOverview(
      [balance("a", { certain_balance: 15000, overdue_amount: 0 })],
      [lease("a")],
    )
    expect(o.rows).toHaveLength(0)
    expect(o.upToDateCount).toBe(1)
  })

  it("une déclaration à confirmer suffit à faire apparaître le bail, sans le compter à jour", () => {
    const o = buildLedgerOverview(
      [balance("a", { pending_credits: 5000 })],
      [lease("a")],
    )
    expect(o.rows).toHaveLength(1)
    expect(o.rows[0].pendingCredits).toBe(5000)
    expect(o.totalPendingCredits).toBe(5000)
    expect(o.upToDateCount).toBe(0)
  })

  it("le litige est agrégé (débits + crédits contestés) et jamais fusionné au dû", () => {
    const o = buildLedgerOverview(
      [balance("a", { disputed_debits: 5000, disputed_credits: 2000 })],
      [lease("a")],
    )
    expect(o.rows[0].disputed).toBe(7000)
    expect(o.rows[0].outstanding).toBe(0)
    expect(o.totalDisputed).toBe(7000)
  })

  it("seuls les baux ACTIFS sans rien à montrer comptent « à jour » ; un bail terminé endetté reste listé", () => {
    const o = buildLedgerOverview(
      [
        balance("actif-ok"),
        balance("termine-ok"),
        balance("termine-dette", { certain_balance: -40000, overdue_amount: 40000 }),
      ],
      [
        lease("actif-ok"),
        lease("termine-ok", { status: "ended" }),
        lease("termine-dette", { status: "ended" }),
      ],
    )
    expect(o.upToDateCount).toBe(1)
    expect(o.rows.map((r) => r.leaseId)).toEqual(["termine-dette"])
  })

  it("trie impayé d'abord (montant décroissant), puis dû total, puis à confirmer", () => {
    const o = buildLedgerOverview(
      [
        balance("attendu", { certain_balance: -40000, overdue_amount: 0 }),
        balance("gros-retard", { certain_balance: -90000, overdue_amount: 90000 }),
        balance("petit-retard", { certain_balance: -10000, overdue_amount: 10000 }),
        balance("declaration", { pending_credits: 5000 }),
      ],
      [lease("attendu"), lease("gros-retard"), lease("petit-retard"), lease("declaration")],
    )
    expect(o.rows.map((r) => r.leaseId)).toEqual([
      "gros-retard",
      "petit-retard",
      "attendu",
      "declaration",
    ])
  })

  it("ignore les soldes de baux absents de la liste (bail archivé) et les baux sans solde", () => {
    const o = buildLedgerOverview(
      [balance("fantome", { certain_balance: -40000, overdue_amount: 40000 })],
      [lease("sans-solde")],
    )
    expect(o.rows).toHaveLength(0)
    expect(o.totalOverdue).toBe(0)
  })

  it("défensif : un impayé SQL qui dépasserait le dû total plancher l'attendu à zéro", () => {
    const o = buildLedgerOverview(
      [balance("a", { certain_balance: -30000, overdue_amount: 40000 })],
      [lease("a")],
    )
    expect(o.rows[0].expected).toBe(0)
    expect(o.rows[0].outstanding).toBe(30000)
  })

  it("une charge variable en attente (pending_debits) fait apparaître le bail", () => {
    const o = buildLedgerOverview([balance("a", { pending_debits: 5000 })], [lease("a")])
    expect(o.rows).toHaveLength(1)
    expect(o.rows[0].pendingDebits).toBe(5000)
    expect(o.upToDateCount).toBe(0)
  })
})

function row(overrides: Partial<LeaseDebtRow> = {}): LeaseDebtRow {
  return {
    leaseId: "a",
    tenantId: "t",
    unitId: "u",
    overdue: 0,
    expected: 0,
    outstanding: 0,
    pendingDebits: 0,
    pendingCredits: 0,
    disputed: 0,
    ...overrides,
  }
}

describe("describeLeaseDebtRow — chaque nature est nommée, jamais fusionnée (ADR-023 §6)", () => {
  it("« en retard » ne recouvre pas l'attendu : les deux natures sont nommées", () => {
    expect(describeLeaseDebtRow(row({ overdue: 40000, expected: 40000, outstanding: 80000 }))).toBe(
      "en retard · attendu",
    )
  })

  it("nomme chaque nature présente", () => {
    expect(describeLeaseDebtRow(row({ expected: 40000, outstanding: 40000 }))).toBe("attendu")
    expect(describeLeaseDebtRow(row({ pendingCredits: 5000 }))).toBe("déclaration à confirmer")
    expect(describeLeaseDebtRow(row({ pendingDebits: 5000 }))).toBe("charge en attente")
    expect(describeLeaseDebtRow(row({ disputed: 5000 }))).toBe("en litige")
    expect(
      describeLeaseDebtRow(row({ overdue: 1, outstanding: 1, pendingCredits: 2, disputed: 3 })),
    ).toBe("en retard · déclaration à confirmer · en litige")
  })
})

describe("leaseDebtRowAmount — le chiffre rouge est l'impayé seul", () => {
  it("retard : montant = impayé (pas le dû total), la somme des lignes rouges recolle avec la tuile", () => {
    expect(leaseDebtRowAmount(row({ overdue: 40000, expected: 40000, outstanding: 80000 }))).toEqual({
      amount: 40000,
      tone: "overdue",
    })
  })

  it("dû non échu : montant = dû total, ton encre", () => {
    expect(leaseDebtRowAmount(row({ expected: 40000, outstanding: 40000 }))).toEqual({
      amount: 40000,
      tone: "due",
    })
  })

  it("déclaration seule : ton muted (une attente n'est pas une dette)", () => {
    expect(leaseDebtRowAmount(row({ pendingCredits: 5000 }))).toEqual({
      amount: 5000,
      tone: "pending",
    })
  })

  it("litige seul : montant contesté, jamais « 0 FCFA »", () => {
    expect(leaseDebtRowAmount(row({ disputed: 7000 }))).toEqual({ amount: 7000, tone: "disputed" })
  })
})
