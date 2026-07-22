export type RentDueStatus = "expected" | "overdue" | "paid" | "cancelled"

export type RentDue = {
  id: string
  landlord_id: string
  lease_id: string
  unit_id: string
  tenant_id: string
  period_start: string
  period_end: string
  due_date: string
  amount_due: number
  currency: string
  status: RentDueStatus
  /** Colonne DB héritée du flux locataire /confirmer, retiré en V1 (Zéro-Clic).
   *  Conservée tant que la colonne existe en base ; plus lue côté app. */
  confirmation_token: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// rent_dues + confirmed allocations sum (view rent_due_balances).
export type RentDueBalance = RentDue & {
  amount_paid: number
}
