export type PaymentMethod = "cash" | "mobile_money" | "bank_transfer" | "other"

export type CollectionStatus = "draft" | "confirmed" | "cancelled"

// A "collection" is the owner-facing encaissement (table rent_receptions).
export type Collection = {
  id: string
  landlord_id: string
  tenant_id: string
  unit_id: string
  received_at: string
  amount_received: number
  currency: string
  payment_method: PaymentMethod
  status: CollectionStatus
  confirmed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type CollectionAllocation = {
  rent_due_id: string
  amount_allocated: number
}
