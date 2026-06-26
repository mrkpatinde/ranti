import { createClient } from "@/lib/supabase/server"
import type { Landlord } from "./types"

/**
 * Returns the landlord profile bound to the current authenticated user, or null
 * if the profile has not been created yet. RLS scopes the row to the caller.
 */
export async function getCurrentLandlord(): Promise<Landlord | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("landlords")
    .select("*")
    .is("deleted_at", null)
    .maybeSingle()

  return (data as Landlord | null) ?? null
}
