import { redirect } from "next/navigation"
import { AUTH_PATHS } from "@/lib/auth/paths"
import { getCurrentLandlord } from "./queries"
import type { Landlord } from "./types"

/**
 * Ensures the current user has completed their landlord profile.
 * Call after requireAuth(). Redirects to the profile step when missing.
 */
export async function requireLandlordProfile(): Promise<Landlord> {
  const landlord = await getCurrentLandlord()

  if (!landlord) {
    redirect(AUTH_PATHS.profile)
  }

  return landlord
}
