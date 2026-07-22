"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "@/lib/auth/paths"
import { getCurrentUser, requireAuth } from "@/lib/auth/server"
import { normalizeName, normalizePhone } from "@/lib/auth/validation"
import { DEFAULT_COUNTRY_CODE, getCountry, normalizeCountryPhone } from "@/lib/auth/countries"

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

  if (!firstName || !lastName) {
    profileError("Indiquez votre prénom et votre nom.")
  }

  const currentUser = await getCurrentUser()
  // Legacy phone-auth accounts (frozen, ADR-010) carry a verified Benin
  // number in their claims: it wins over the form. Google-only signups pick
  // their country in the form; the number is validated against the registry's
  // numbering plan (ADR-008).
  const claimPhone = normalizePhone(claims.phone ?? null)
  const userPhone = normalizePhone(currentUser?.phone ?? null)
  const country =
    getCountry(String(formData.get("country") ?? "")) ?? getCountry(DEFAULT_COUNTRY_CODE)!
  const formPhone = normalizeCountryPhone(country, formData.get("phone"))
  const phone = claimPhone ?? userPhone ?? formPhone

  if (!phone) {
    profileError(
      `Entrez votre numéro mobile local à ${country.localDigits} chiffres (${country.name}, ex. ${country.placeholder}).`,
    )
  }

  const supabase = await createClient()

  const { error } = await supabase.from("landlords").insert({
    auth_user_id: claims.sub,
    phone,
    first_name: firstName,
    last_name: lastName,
    civility: "not_specified",
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

export async function updateLandlordProfile() {
  await requireAuth()
  settingsError("Les informations du propriétaire sont verrouillées pour protéger les quittances et l'historique du registre.")
}

function paymentError(message: string): never {
  redirect(`/settings/payment?error=${encodeURIComponent(message)}`)
}

/**
 * Met à jour l'alias de paiement PI-SPI du propriétaire. Donnée mutable,
 * distincte de l'identité verrouillée (ADR-002). Alias vide = effacé.
 * RLS (landlords_update_own) restreint déjà la ligne au propriétaire ;
 * le filtre explicite auth_user_id est une garde de défense.
 */
export async function updateLandlordPaymentAlias(formData: FormData) {
  const claims = await requireAuth()

  const rawAlias = String(formData.get("payment_alias") ?? "").trim()
  const rawType = String(formData.get("payment_alias_type") ?? "").trim()

  if (rawAlias.length > 64) {
    paymentError("Alias trop long (64 caractères maximum).")
  }

  const alias = rawAlias.length > 0 ? rawAlias : null
  const type = rawType === "address" ? "address" : rawType === "phone" ? "phone" : null
  // Un alias sans type par défaut = numéro ; alias vide = on efface aussi le type.
  const finalType = alias ? (type ?? "phone") : null

  const supabase = await createClient()
  const { error } = await supabase
    .from("landlords")
    .update({ payment_alias: alias, payment_alias_type: finalType })
    .eq("auth_user_id", claims.sub)

  if (error) {
    console.error("updateLandlordPaymentAlias failed", error.code, error.message)
    paymentError("Enregistrement impossible. Réessayez.")
  }

  revalidatePath("/settings/payment")
  revalidatePath("/collections/new")
  redirect("/settings/payment?success=1")
}

/**
 * Met à jour l'adresse postale du bailleur. Donnée mutable (contact), distincte
 * de l'identité verrouillée (ADR-002). Figure sur la quittance pour identifier
 * le bailleur (Loi 2022-30, art. 67). Champs vides = effacés.
 */
export async function updateLandlordAddress(formData: FormData) {
  const claims = await requireAuth()

  const rawAddress = String(formData.get("address") ?? "").trim()
  const rawCity = String(formData.get("city") ?? "").trim()

  if (rawAddress.length > 200 || rawCity.length > 120) {
    settingsError("Adresse trop longue.")
  }

  const address = rawAddress.length > 0 ? rawAddress : null
  const city = rawCity.length > 0 ? rawCity : null

  const supabase = await createClient()
  const { error } = await supabase
    .from("landlords")
    .update({ address, city })
    .eq("auth_user_id", claims.sub)

  if (error) {
    console.error("updateLandlordAddress failed", error.code, error.message)
    settingsError("Enregistrement impossible. Réessayez.")
  }

  revalidatePath("/settings/profile")
  redirect("/settings/profile?success=adresse")
}
