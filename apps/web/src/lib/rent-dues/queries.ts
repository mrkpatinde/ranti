import { createClient } from "@/lib/supabase/server"
import type { RentDue } from "./types"

export async function getLandlordRentDues(landlordId: string): Promise<RentDue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_dues")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (error) {
    return []
  }

  return (data ?? []) as RentDue[]
}

export async function getLeaseRentDues(landlordId: string, leaseId: string): Promise<RentDue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_dues")
    .select("*")
    .eq("landlord_id", landlordId)
    .eq("lease_id", leaseId)
    .is("deleted_at", null)
    .order("period_start", { ascending: true })

  if (error) {
    return []
  }

  return (data ?? []) as RentDue[]
}

export async function getRentDue(landlordId: string, id: string): Promise<RentDue | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("rent_dues")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  return (data as RentDue | null) ?? null
}
