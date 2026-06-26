import { createClient } from "@/lib/supabase/server"
import type { Unit } from "./types"

export async function getLandlordUnits(landlordId: string): Promise<Unit[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return []
  }

  return (data ?? []) as Unit[]
}

export async function getUnit(landlordId: string, id: string): Promise<Unit | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("units")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  return (data as Unit | null) ?? null
}
