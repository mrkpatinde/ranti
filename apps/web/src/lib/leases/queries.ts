import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Lease } from "./types"

export async function getLandlordLeases(landlordId: string): Promise<Lease[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("leases")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) failQuery("leases", error)

  return (data ?? []) as Lease[]
}

export async function getLease(landlordId: string, id: string): Promise<Lease | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("leases")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("leases", error)

  return (data as Lease | null) ?? null
}
