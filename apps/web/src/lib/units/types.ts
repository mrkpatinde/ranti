export const UNIT_TYPES = [
  "house",
  "apartment",
  "room",
  "shop",
  "store",
  "office",
  "warehouse",
  "other",
] as const

export type UnitType = (typeof UNIT_TYPES)[number]

export type Unit = {
  id: string
  landlord_id: string
  property_id: string
  name: string
  unit_type: UnitType
  availability_status: "available" | "occupied"
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
