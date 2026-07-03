import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Collection } from "./types"
import { monthRange, sumCollectedInMonth, type MonthlyReception } from "./monthly"

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

// Encaissé pendant le mois : allocations des réceptions confirmées reçues
// dans [start, end). Jamais une somme historique globale.
export async function getCollectedThisMonth(
  landlordId: string,
  reference = new Date()
): Promise<{ amount: number; count: number }> {
  const { start, end } = monthRange(reference)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_receptions")
    .select("status, deleted_at, received_at, rent_reception_allocations(amount_allocated)")
    .eq("landlord_id", landlordId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .gte("received_at", start.toISOString())
    .lt("received_at", end.toISOString())

  if (error) failQuery("rent_receptions", error)

  return sumCollectedInMonth((data ?? []) as MonthlyReception[], { start, end })
}
