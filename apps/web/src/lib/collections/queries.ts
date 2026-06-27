import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Collection } from "./types"

export async function getLandlordCollections(landlordId: string): Promise<Collection[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_receptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("received_at", { ascending: false })

  if (error) failQuery("rent_receptions", error)

  return (data ?? []) as Collection[]
}

export async function getCollection(landlordId: string, id: string): Promise<Collection | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_receptions")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("rent_receptions", error)

  return (data as Collection | null) ?? null
}
