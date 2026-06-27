export type ReceiptStatus = "issued" | "cancelled"

// quittance = rent fully paid; receipt = partial payment proof.
export type ReceiptKind = "receipt" | "quittance"

export type ReceiptSnapshot = {
  tenant?: { first_name: string; last_name: string; phone: string | null }
  unit?: { name: string; type: string }
  reception?: {
    amount_received: number
    currency: string
    payment_method: string
    received_at: string
  }
  allocations?: Array<{ period_start: string; period_end: string; amount_allocated: number }>
}

export type Receipt = {
  id: string
  landlord_id: string
  rent_reception_id: string
  receipt_number: string
  issued_at: string
  total_amount: number
  currency: string
  status: ReceiptStatus
  kind: ReceiptKind
  pdf_storage_path: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  snapshot: ReceiptSnapshot
  created_at: string
  updated_at: string
  deleted_at: string | null
}
