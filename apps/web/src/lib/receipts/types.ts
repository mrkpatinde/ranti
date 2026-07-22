export type ReceiptStatus = "issued" | "cancelled"

// quittance = rent fully paid; receipt = partial payment proof.
export type ReceiptKind = "receipt" | "quittance"

// ADR-013 — cycle d'acquittement locataire, orthogonal à ReceiptStatus.
export type TenantAck = "unilateral" | "read" | "certified" | "disputed"

// Nature d'une contestation locataire.
export type ContestNature = "amount" | "date" | "not_paid"

export type ReceiptSnapshot = {
  tenant?: { first_name: string; last_name: string; phone: string | null }
  unit?: { name: string; type: string }
  property?: { name?: string; city: string | null; address: string | null }
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
  tenant_ack: TenantAck
  tenant_token: string
  tenant_read_at: string | null
  tenant_certified_at: string | null
  contested_at: string | null
  contest_nature: ContestNature | null
  contested_amount: number | null
  contested_period: string | null
  sha256_fingerprint: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Vue publique du reçu, renvoyée par la RPC get_receipt_by_token.
// L'anon ne lit aucune table : uniquement ces champs.
export type ReceiptByToken = {
  receipt_number: string
  kind: ReceiptKind
  status: ReceiptStatus
  issued_at: string
  total_amount: number
  currency: string
  landlord_first_name: string | null
  landlord_last_name: string | null
  landlord_address: string | null
  landlord_city: string | null
  tenant_first_name: string | null
  tenant_last_name: string | null
  unit_name: string | null
  property_city: string | null
  property_address: string | null
  allocations: Array<{ period_start: string; period_end: string; amount_allocated: number }>
  tenant_ack: TenantAck
  tenant_read_at: string | null
  tenant_certified_at: string | null
  contested_at: string | null
  contest_nature: ContestNature | null
  contested_amount: number | null
  contested_period: string | null
  sha256_fingerprint: string | null
}
