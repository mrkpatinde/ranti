export type LeaseStatus = "draft" | "active" | "ended" | "cancelled"

export type Lease = {
  id: string
  landlord_id: string
  unit_id: string
  tenant_id: string
  monthly_rent_amount: number
  currency: string
  due_day: number
  start_date: string
  end_date: string | null
  status: LeaseStatus
  contract_storage_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
