import { describe, expect, it } from "vitest"
import {
  feeRateLabel,
  sortClosingRows,
  statementToClosingRow,
  sumClosingRows,
  sumStatementLines,
} from "../totals"
import type { ClosingRow, OwnerStatement, OwnerStatementLine } from "../types"

function line(over: Partial<OwnerStatementLine> = {}): OwnerStatementLine {
  const collected = over.collected ?? 0
  const rate = over.fee_rate_bp ?? 800
  const fee = over.fee ?? Math.floor((collected * rate) / 10000)
  return {
    unit_id: over.unit_id ?? "u1",
    property_name: over.property_name ?? "Résidence Zogbo",
    unit_name: over.unit_name ?? "Lot A",
    tenant_name: over.tenant_name ?? "Awa Diop",
    lease_id: over.lease_id ?? "l1",
    expected: over.expected ?? 0,
    collected,
    fee,
    net: over.net ?? collected - fee,
    fee_rate_bp: rate,
  }
}

describe("sumStatementLines", () => {
  it("le total est exactement la somme des lignes affichées", () => {
    // Honoraires arrondis à l'entier inférieur ligne par ligne : réappliquer
    // le taux sur le total donnerait 28 001 au lieu de 28 000.
    const lines = [
      line({ unit_id: "u1", collected: 100_003, expected: 100_003 }),
      line({ unit_id: "u2", collected: 200_005, expected: 200_005 }),
      line({ unit_id: "u3", collected: 50_007, expected: 50_007 }),
    ]

    const totals = sumStatementLines(lines)

    expect(totals.collected).toBe(350_015)
    expect(totals.fee).toBe(8_000 + 16_000 + 4_000)
    expect(totals.fee).toBe(28_000)
    expect(totals.net).toBe(totals.collected - totals.fee)
    expect(totals.net).toBe(lines.reduce((sum, l) => sum + l.net, 0))
  })

  it("un lot vacant compte pour zéro sans disparaître du total", () => {
    const lines = [
      line({ unit_id: "u1", expected: 120_000, collected: 120_000 }),
      line({ unit_id: "u2", tenant_name: null, lease_id: null, expected: 0, collected: 0 }),
    ]

    const totals = sumStatementLines(lines)

    expect(lines).toHaveLength(2)
    expect(totals.expected).toBe(120_000)
    expect(totals.collected).toBe(120_000)
  })

  it("impayé = attendu moins encaissé, jamais négatif sur une avance", () => {
    expect(sumStatementLines([line({ expected: 150_000, collected: 90_000 })]).outstanding).toBe(
      60_000,
    )
    expect(sumStatementLines([line({ expected: 90_000, collected: 150_000 })]).outstanding).toBe(0)
  })

  it("aucune ligne : tout à zéro", () => {
    expect(sumStatementLines([])).toEqual({
      expected: 0,
      collected: 0,
      fee: 0,
      net: 0,
      outstanding: 0,
    })
  })
})

describe("statementToClosingRow", () => {
  const statement: OwnerStatement = {
    owner: {
      id: "o1",
      display_name: "Mme Hounkpatin",
      phone: "+22990010203",
      email: null,
      fee_rate_bp: 800,
    },
    agency: { name: "Agence Zogbo", company_name: null, phone: null, address: null, city: "Cotonou" },
    period: { month: "2026-08", from: "2026-08-01", to: "2026-08-31" },
    lines: [
      line({ unit_id: "u1", expected: 120_000, collected: 120_000 }),
      line({ unit_id: "u2", expected: 80_000, collected: 0, tenant_name: null }),
    ],
    // Totaux de la RPC volontairement faux : la ligne du tableau doit venir
    // des lignes, pas d'un total déjà calculé ailleurs.
    totals: { expected: 999, collected: 999, fee: 999, net_due_to_owner: 999, outstanding: 999 },
    generated_at: "2026-08-09T10:00:00.000Z",
  }

  it("agrège le mandant depuis ses lignes, pas depuis les totaux reçus", () => {
    const row = statementToClosingRow(statement)

    expect(row).toEqual({
      ownerId: "o1",
      name: "Mme Hounkpatin",
      phone: "+22990010203",
      feeRateBp: 800,
      units: 2,
      expected: 200_000,
      collected: 120_000,
      fee: 9_600,
      net: 110_400,
      outstanding: 80_000,
    })
  })
})

describe("sumClosingRows", () => {
  function row(over: Partial<ClosingRow>): ClosingRow {
    return {
      ownerId: "o",
      name: "Mandant",
      phone: null,
      feeRateBp: 800,
      units: 1,
      expected: 0,
      collected: 0,
      fee: 0,
      net: 0,
      outstanding: 0,
      ...over,
    }
  }

  it("la ligne de total est la somme des mandants affichés", () => {
    const rows = [
      row({ ownerId: "a", units: 3, expected: 300_000, collected: 200_000, fee: 16_000, net: 184_000, outstanding: 100_000 }),
      row({ ownerId: "b", units: 2, expected: 150_000, collected: 150_000, fee: 15_000, net: 135_000 }),
    ]

    expect(sumClosingRows(rows)).toEqual({
      units: 5,
      expected: 450_000,
      collected: 350_000,
      fee: 31_000,
      net: 319_000,
      outstanding: 100_000,
    })
  })

  it("portefeuille vide : totaux à zéro", () => {
    expect(sumClosingRows([])).toEqual({
      units: 0,
      expected: 0,
      collected: 0,
      fee: 0,
      net: 0,
      outstanding: 0,
    })
  })

  it("tri : le net le plus élevé d'abord, puis par nom", () => {
    const rows = [
      row({ ownerId: "a", name: "Zinsou", net: 10_000 }),
      row({ ownerId: "b", name: "Adjovi", net: 90_000 }),
      row({ ownerId: "c", name: "Bio", net: 10_000 }),
    ]

    expect(sortClosingRows(rows).map((r) => r.name)).toEqual(["Adjovi", "Bio", "Zinsou"])
  })
})

describe("feeRateLabel", () => {
  it("800 points de base = 8 %", () => {
    expect(feeRateLabel(800)).toBe("8 %")
  })

  it("taux non entier : virgule française", () => {
    expect(feeRateLabel(750)).toBe("7,5 %")
  })

  it("sans honoraires", () => {
    expect(feeRateLabel(0)).toBe("0 %")
  })
})
