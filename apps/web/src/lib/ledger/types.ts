// Grand Livre de Confiance (ADR-023) — lecture de la vue lease_balances.
// Miroir 1:1 des colonnes SQL (supabase/migrations/20260716150000, §5) :
// trois nombres jamais fusionnés (certain / en attente / en litige) + impayé.

export type LeaseBalance = {
  lease_id: string
  landlord_id: string
  /** Σ crédits validés − Σ débits validés : ce que les deux parties (ou le rail) reconnaissent. Négatif = le locataire doit. */
  certain_balance: number
  /** Débits affirmés, pas encore reconnus. Dormant : les charges variables sont retirées (ADR-026), cette colonne reste à 0. */
  pending_debits: number
  /** Crédits affirmés, pas encore reconnus (brouillons, déclarations locataire à confirmer). */
  pending_credits: number
  /** Débits contestés. Dormant depuis le retrait des charges (ADR-026), reste à 0. */
  disputed_debits: number
  /** Crédits contestés — désaccord documenté, hors solde certain. */
  disputed_credits: number
  /** Impayé : lignes certaines exigibles aujourd'hui, débits − crédits, plancher zéro. */
  overdue_amount: number
}
