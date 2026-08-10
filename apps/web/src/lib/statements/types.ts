// Relevé mensuel du mandant — formes renvoyées par les RPC SQL
// `owner_statement` / `owner_statement_lines` (migration 20260809120700) et
// par la vue `owner_month_summary`.
//
// L'agence gère des lots pour des propriétaires mandants qui ne sont pas
// utilisateurs de Ranti : le relevé est le document qu'elle leur remet chaque
// mois. Les montants sont des entiers XOF.

export type OwnerStatementLine = {
  unit_id: string
  property_name: string | null
  unit_name: string | null
  /** null quand le lot est vacant sur le mois — la ligne reste affichée à 0. */
  tenant_name: string | null
  lease_id: string | null
  expected: number
  collected: number
  fee: number
  net: number
  fee_rate_bp: number
}

export type OwnerStatementOwner = {
  id: string
  display_name: string
  phone: string | null
  email: string | null
  fee_rate_bp: number
}

export type OwnerStatementAgency = {
  /** Nom affiché en en-tête : la raison sociale quand elle existe, sinon le
   *  nom de la personne (coalesce côté SQL, migration 20260810120000). */
  name: string | null
  /** Raison sociale brute ; null pour une gestion en nom propre. */
  company_name: string | null
  /** RCCM / IFU (migration 20260810130000). Optionnels : absents d'un relevé
   *  généré avant la migration ; rendus en petite ligne sous le nom quand
   *  présents. */
  company_rccm?: string | null
  company_ifu?: string | null
  phone: string | null
  address: string | null
  city: string | null
}

export type OwnerStatementPeriod = {
  /** « YYYY-MM ». */
  month: string
  /** Premier jour du mois (YYYY-MM-DD). */
  from: string
  /** Dernier jour du mois (YYYY-MM-DD). */
  to: string
}

/** Totaux renvoyés par la RPC. L'écran et le PDF recalculent les leurs à
 *  partir des lignes affichées (cf. `sumStatementLines`) : le document doit
 *  s'additionner à la main. */
export type OwnerStatementTotals = {
  expected: number
  collected: number
  fee: number
  net_due_to_owner: number
  outstanding: number
}

export type OwnerStatement = {
  owner: OwnerStatementOwner
  agency: OwnerStatementAgency
  period: OwnerStatementPeriod
  lines: OwnerStatementLine[]
  totals: OwnerStatementTotals
  generated_at: string
}

/** Une ligne de la vue `owner_month_summary` : le portefeuille de mandants. */
export type OwnerSummaryRow = {
  owner_id: string
  landlord_id: string
  display_name: string
  fee_rate_bp: number
  units: number
  collected: number
  fee: number
  net_due_to_owner: number
}

/** Une ligne du tableau de clôture : un mandant, un mois. */
export type ClosingRow = {
  ownerId: string
  name: string
  phone: string | null
  feeRateBp: number
  units: number
  expected: number
  collected: number
  fee: number
  net: number
  outstanding: number
}

export type ClosingTotals = {
  units: number
  expected: number
  collected: number
  fee: number
  net: number
  outstanding: number
}
