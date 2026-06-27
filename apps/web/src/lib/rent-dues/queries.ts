import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { RentDue, RentDueBalance } from "./types"

export async function getLandlordRentDues(landlordId: string): Promise<RentDue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_dues")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (error) failQuery("rent_dues", error)

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

  if (error) failQuery("rent_dues", error)

  return (data ?? []) as RentDue[]
}

// Dues with confirmed amount_paid (view rent_due_balances) — for the real
// remaining amount (amount_due - amount_paid).
export async function getLandlordDueBalances(landlordId: string): Promise<RentDueBalance[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_due_balances")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (error) failQuery("rent_due_balances", error)

  return (data ?? []) as RentDueBalance[]
}

export async function getLeaseDueBalances(landlordId: string, leaseId: string): Promise<RentDueBalance[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_due_balances")
    .select("*")
    .eq("landlord_id", landlordId)
    .eq("lease_id", leaseId)
    .is("deleted_at", null)
    .order("period_start", { ascending: true })

  if (error) failQuery("rent_due_balances", error)

  return (data ?? []) as RentDueBalance[]
}

export async function getRentDue(landlordId: string, id: string): Promise<RentDue | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_dues")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("rent_dues", error)

  return (data as RentDue | null) ?? null
}
