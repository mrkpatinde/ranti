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

// Raison sociale : champ libre (REQUIS sur la branche entreprise de
// l'onboarding, absent en nom propre), borné pour rester imprimable sur les
// documents. RCCM / IFU : identifiants légaux libres, mêmes contraintes.
const COMPANY_NAME_MAX = 160
const COMPANY_ID_MAX = 64

function normalizeCompanyName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeCompanyId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function createLandlordProfile(formData: FormData) {
  const claims = await requireAuth()

  // Bifurcation d'entrée (retour fondateur 2026-08-10) : une entreprise de
  // gestion, ou une gestion en nom propre. La branche entreprise exige la
  // raison sociale ; en nom propre, aucun champ entreprise n'est enregistré.
  const isCompany = String(formData.get("account_type") ?? "") === "company"

  const firstName = normalizeName(formData.get("first_name"))
  const lastName = normalizeName(formData.get("last_name"))
  const companyName = isCompany ? normalizeCompanyName(formData.get("company_name")) : null
  const companyRccm = isCompany ? normalizeCompanyId(formData.get("company_rccm")) : null
  const companyIfu = isCompany ? normalizeCompanyId(formData.get("company_ifu")) : null
  const rawAddress = isCompany ? String(formData.get("address") ?? "").trim() : ""
  const rawCity = isCompany ? String(formData.get("city") ?? "").trim() : ""

  if (!firstName || !lastName) {
    profileError("Indiquez votre prénom et votre nom.")
  }

  if (isCompany && !companyName) {
    profileError("Indiquez la raison sociale de votre entreprise.")
  }

  if (companyName && companyName.length > COMPANY_NAME_MAX) {
    profileError(`Nom d'entreprise trop long (${COMPANY_NAME_MAX} caractères maximum).`)
  }

  if ((companyRccm && companyRccm.length > COMPANY_ID_MAX) || (companyIfu && companyIfu.length > COMPANY_ID_MAX)) {
    profileError(`RCCM ou IFU trop long (${COMPANY_ID_MAX} caractères maximum).`)
  }

  if (rawAddress.length > 200 || rawCity.length > 120) {
    profileError("Adresse trop longue.")
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
    company_name: companyName,
    company_rccm: companyRccm,
    company_ifu: companyIfu,
    address: rawAddress.length > 0 ? rawAddress : null,
    city: rawCity.length > 0 ? rawCity : null,
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

    // Session fantôme : le cookie pointe vers un utilisateur auth supprimé
    // (FK auth_user_id violée). « Réessayez » serait un mur sans issue — on
    // déconnecte proprement et on renvoie vers la connexion.
    if (error.code === "23503" && isConstraintError(error.message, "landlords_auth_user_id_fkey")) {
      await supabase.auth.signOut()
      revalidatePath("/", "layout")
      redirect(
        `${AUTH_PATHS.signIn}?error=${encodeURIComponent("Votre session a expiré. Reconnectez-vous.")}`,
      )
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
 * Met à jour la raison sociale et les identifiants légaux (RCCM, IFU) de
 * l'entreprise de gestion. Données mutables, distinctes de l'identité
 * verrouillée (ADR-002) : les documents émis sont figés au snapshot, un
 * changement de raison sociale ne réécrit pas l'histoire. Champ vide =
 * effacé (raison sociale vide = retour à la gestion en nom propre).
 */
export async function updateLandlordCompanyName(formData: FormData) {
  const claims = await requireAuth()

  const companyName = normalizeCompanyName(formData.get("company_name"))
  const companyRccm = normalizeCompanyId(formData.get("company_rccm"))
  const companyIfu = normalizeCompanyId(formData.get("company_ifu"))

  if (companyName && companyName.length > COMPANY_NAME_MAX) {
    settingsError(`Nom d'entreprise trop long (${COMPANY_NAME_MAX} caractères maximum).`)
  }

  if ((companyRccm && companyRccm.length > COMPANY_ID_MAX) || (companyIfu && companyIfu.length > COMPANY_ID_MAX)) {
    settingsError(`RCCM ou IFU trop long (${COMPANY_ID_MAX} caractères maximum).`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("landlords")
    .update({
      company_name: companyName,
      company_rccm: companyRccm,
      company_ifu: companyIfu,
    })
    .eq("auth_user_id", claims.sub)

  if (error) {
    console.error("updateLandlordCompanyName failed", error.code, error.message)
    settingsError("Enregistrement impossible. Réessayez.")
  }

  revalidatePath("/settings/profile")
  redirect("/settings/profile?success=entreprise")
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
