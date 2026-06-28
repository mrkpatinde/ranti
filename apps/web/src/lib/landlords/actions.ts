"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "@/lib/auth/paths"
import { getCurrentUser, requireAuth } from "@/lib/auth/server"
import { normalizeCivility, normalizeName, normalizePhone } from "@/lib/auth/validation"

function profileError(message: string): never {
  redirect(`${AUTH_PATHS.profile}?error=${encodeURIComponent(message)}`)
}

/**
 * Creates the business landlord profile after authentication.
 * Phone/password users keep the verified phone from Supabase Auth.
 * Google users must provide a phone in the onboarding profile step because
 * Google OAuth does not reliably expose a phone number to Supabase.
 */
export async function createLandlordProfile(formData: FormData) {
  const claims = await requireAuth()

  const firstName = normalizeName(formData.get("first_name"))
  const lastName = normalizeName(formData.get("last_name"))
  const civility = normalizeCivility(formData.get("civility"))

  if (!firstName || !lastName) {
    profileError("Indiquez votre prénom et votre nom.")
  }

  const currentUser = await getCurrentUser()
  const sessionPhone = claims.phone ?? currentUser?.phone
  const onboardingPhone = normalizePhone(formData.get("phone"))
  const phone = sessionPhone ?? onboardingPhone

  if (!phone) {
    profileError("Entrez votre numéro béninois pour terminer votre profil.")
  }

  const supabase = await createClient()

  const { error } = await supabase.from("landlords").insert({
    auth_user_id: claims.sub,
    phone,
    first_name: firstName,
    last_name: lastName,
    civility: civility ?? "not_specified",
  })

  if (error) {
    // Unique violation = profile already exists for this user; treat as done.
    if (error.code === "23505") {
      revalidatePath("/", "layout")
      redirect(AUTH_PATHS.afterSignIn)
    }

    console.error("createLandlordProfile: insert failed", error.code, error.message)
    profileError("Création du profil impossible. Réessayez.")
  }

  revalidatePath("/", "layout")
  redirect(AUTH_PATHS.afterSignIn)
}
