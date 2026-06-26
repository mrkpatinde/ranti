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
