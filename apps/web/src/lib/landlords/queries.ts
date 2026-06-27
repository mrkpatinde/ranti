import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Landlord } from "./types"

/**
 * Returns the landlord profile bound to the current authenticated user, or null
 * if the profile has not been created yet. RLS scopes the row to the caller.
 * Throws QueryError on DB/RLS failure — never silently returns null.
 */
export async function getCurrentLandlord(): Promise<Landlord | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("landlords")
    .select("*")
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("landlords", error)

  return (data as Landlord | null) ?? null
}
