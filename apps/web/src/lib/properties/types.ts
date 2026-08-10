export type Property = {
  id: string
  landlord_id: string
  name: string
  city: string | null
  address: string | null
  notes: string | null
  // Mandant pour le compte de qui le bien est géré. null = bien détenu en
  // propre par le titulaire du compte (migration 20260809120500).
  owner_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
