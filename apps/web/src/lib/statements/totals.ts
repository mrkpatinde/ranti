// Agrégation du relevé — pur, sans I/O.
//
// Règle unique : le total affiché est TOUJOURS la somme des lignes affichées.
// Les honoraires sont arrondis à l'entier inférieur ligne par ligne côté SQL ;
// on ne réapplique jamais le taux sur un total, sinon l'écran et le PDF
// afficheraient un franc de plus que la somme des lignes et un mandant qui
// recompte à la main tomberait sur un autre chiffre.

import type {
  ClosingRow,
  ClosingTotals,
  OwnerStatement,
  OwnerStatementLine,
} from "./types"

export type StatementTotals = {
  expected: number
  collected: number
  fee: number
  net: number
  /** Reste dû sur le mois : attendu − encaissé, jamais négatif (avance). */
  outstanding: number
}

export function sumStatementLines(lines: OwnerStatementLine[]): StatementTotals {
  let expected = 0
  let collected = 0
  let fee = 0
  let net = 0

  for (const line of lines) {
    expected += line.expected
    collected += line.collected
    fee += line.fee
    net += line.net
  }

  return { expected, collected, fee, net, outstanding: Math.max(0, expected - collected) }
}

/** Le relevé d'un mandant ramené à sa ligne du tableau de clôture. */
export function statementToClosingRow(statement: OwnerStatement): ClosingRow {
  const totals = sumStatementLines(statement.lines)

  return {
    ownerId: statement.owner.id,
    name: statement.owner.display_name,
    phone: statement.owner.phone,
    feeRateBp: statement.owner.fee_rate_bp,
    units: statement.lines.length,
    expected: totals.expected,
    collected: totals.collected,
    fee: totals.fee,
    net: totals.net,
    outstanding: totals.outstanding,
  }
}

export function sumClosingRows(rows: ClosingRow[]): ClosingTotals {
  let units = 0
  let expected = 0
  let collected = 0
  let fee = 0
  let net = 0
  let outstanding = 0

  for (const row of rows) {
    units += row.units
    expected += row.expected
    collected += row.collected
    fee += row.fee
    net += row.net
    outstanding += row.outstanding
  }

  return { units, expected, collected, fee, net, outstanding }
}

/** « 800 » (points de base) → « 8 % ». Décimale seulement si nécessaire. */
export function feeRateLabel(feeRateBp: number): string {
  const percent = feeRateBp / 100
  const text = Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/0$/, "")
  return `${text.replace(".", ",")} %`
}

/** Tri du tableau de clôture : le net à reverser le plus élevé d'abord, puis
 *  par nom — la clôture se lit par ce qu'il reste à sortir. */
export function sortClosingRows(rows: ClosingRow[]): ClosingRow[] {
  return [...rows].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name, "fr"))
}
