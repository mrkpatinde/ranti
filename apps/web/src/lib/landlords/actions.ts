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

function settingsError(message: string): never {
  redirect(`/settings/profile?error=${encodeURIComponent(message)}`)
}

function isConstraintError(message: string, constraint: string) {
  return message.includes(constraint)
}

export async function createLandlordProfile(formData: FormData) {
  const claims = await requireAuth()

  const firstName = normalizeName(formData.get("first_name"))
  const lastName = normalizeName(formData.get("last_name"))
  const civility = normalizeCivility(formData.get("civility"))

  if (!firstName || !lastName) {
    profileError("Indiquez votre prénom et votre nom.")
  }

  const currentUser = await getCurrentUser()
  const claimPhone = normalizePhone(claims.phone ?? null)
  const userPhone = normalizePhone(currentUser?.phone ?? null)
  const formPhone = normalizePhone(formData.get("phone"))
  const phone = claimPhone ?? userPhone ?? formPhone

  if (!phone) {
    profileError("Entrez votre numéro local à 10 chiffres.")
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
    if (error.code === "23505") {
      if (isConstraintError(error.message, "landlords_auth_user_id_key")) {
        revalidatePath("/", "layout")
        redirect(AUTH_PATHS.afterSignIn)
      }

      if (isConstraintError(error.message, "landlords_phone_key")) {
        profileError("Ce numéro est déjà lié à un autre compte Ranti.")
      }
    }

    console.error("createLandlordProfile failed", error.code, error.message)
    profileError("Création du profil impossible. Réessayez.")
  }

  revalidatePath("/", "layout")
  redirect(AUTH_PATHS.afterSignIn)
}

export async function updateLandlordProfile(formData: FormData) {
  const claims = await requireAuth()

  const firstName = normalizeName(formData.get("first_name"))
  const lastName = normalizeName(formData.get("last_name"))
  const civility = normalizeCivility(formData.get("civility"))
  const phone = normalizePhone(formData.get("phone"))

  if (!firstName || !lastName) {
    settingsError("Indiquez votre prénom et votre nom.")
  }

  if (!phone) {
    settingsError("Entrez votre numéro local à 10 chiffres.")
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("landlords")
    .update({
      phone,
      first_name: firstName,
      last_name: lastName,
      civility: civility ?? "not_specified",
    })
    .eq("auth_user_id", claims.sub)
    .is("deleted_at", null)

  if (error) {
    if (error.code === "23505" && isConstraintError(error.message, "landlords_phone_key")) {
      settingsError("Ce numéro est déjà lié à un autre compte Ranti.")
    }

    console.error("updateLandlordProfile failed", error.code, error.message)
    settingsError("Impossible de modifier votre profil. Réessayez.")
  }

  revalidatePath("/", "layout")
  revalidatePath("/dashboard")
  redirect("/settings/profile?notice=profile_updated")
}
