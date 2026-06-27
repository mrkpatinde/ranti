import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Tenant } from "./types"

export async function getLandlordTenants(landlordId: string): Promise<Tenant[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) failQuery("tenants", error)

  return (data ?? []) as Tenant[]
}

export async function getTenant(landlordId: string, id: string): Promise<Tenant | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("tenants", error)

  return (data as Tenant | null) ?? null
}
