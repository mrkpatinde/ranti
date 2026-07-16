// Grand Livre de Confiance (ADR-023) — lecture de la vue lease_balances.
// Miroir 1:1 des colonnes SQL (supabase/migrations/20260716150000, §5) :
// trois nombres jamais fusionnés (certain / en attente / en litige) + impayé.

export type LedgerChargeType = "reparation" | "frais"
export type LedgerChargeStatus = "pending" | "validated" | "disputed" | "withdrawn"
export type LedgerContestNature = "amount" | "not_owed" | "already_paid" | "other"

/** Charge variable du grand livre (débit affirmé par le bailleur, matrice §3 ligne 2). */
export type LedgerCharge = {
  id: string
  lease_id: string
  type: LedgerChargeType
  amount: number
  currency: string
  occurred_at: string
  due_date: string | null
  status: LedgerChargeStatus
  validated_by: "landlord" | "tenant" | "system" | null
  validated_at: string | null
  disputed_at: string | null
  contest_nature: LedgerContestNature | null
  contested_amount: number | null
  tenant_comment: string | null
  resolution: "retrait_contestation" | "retrait_auteur" | "remplacement" | null
  resolved_at: string | null
  replaced_by: string | null
  tenant_token: string | null
  label: string
}

/** Ligne renvoyée par la RPC publique get_ledger_line_by_token (page locataire). */
export type LedgerLineByToken = {
  label: string
  type: string
  amount: number
  currency: string
  due_date: string | null
  occurred_at: string
  status: LedgerChargeStatus
  validated_at: string | null
  disputed_at: string | null
  contest_nature: LedgerContestNature | null
  contested_amount: number | null
  tenant_comment: string | null
  resolution: "retrait_contestation" | "retrait_auteur" | "remplacement" | null
  landlord_first_name: string | null
  landlord_last_name: string | null
  tenant_first_name: string | null
  tenant_last_name: string | null
  unit_name: string | null
}

export type LeaseBalance = {
  lease_id: string
  landlord_id: string
  /** Σ crédits validés − Σ débits validés : ce que les deux parties (ou le rail) reconnaissent. Négatif = le locataire doit. */
  certain_balance: number
  /** Débits affirmés, pas encore reconnus (charges variables — phase « différenciant »). */
  pending_debits: number
  /** Crédits affirmés, pas encore reconnus (brouillons, déclarations locataire à confirmer). */
  pending_credits: number
  /** Débits contestés — désaccord documenté, hors solde certain. */
  disputed_debits: number
  /** Crédits contestés — désaccord documenté, hors solde certain. */
  disputed_credits: number
  /** Impayé : lignes certaines exigibles aujourd'hui, débits − crédits, plancher zéro. */
  overdue_amount: number
}
