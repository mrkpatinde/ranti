import { createClient } from "@/lib/supabase/server"
import type { Property } from "./types"

export async function getLandlordProperties(landlordId: string): Promise<Property[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return []
  }

  return (data ?? []) as Property[]
}

export async function getProperty(landlordId: string, id: string): Promise<Property | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  return (data as Property | null) ?? null
}
