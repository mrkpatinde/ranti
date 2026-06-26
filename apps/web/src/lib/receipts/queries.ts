import { createClient } from "@/lib/supabase/server"
import type { Receipt } from "./types"

export async function getLandlordReceipts(landlordId: string): Promise<Receipt[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("issued_at", { ascending: false })

  if (error) {
    return []
  }

  return (data ?? []) as Receipt[]
}

export async function getReceipt(landlordId: string, id: string): Promise<Receipt | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  return (data as Receipt | null) ?? null
}
