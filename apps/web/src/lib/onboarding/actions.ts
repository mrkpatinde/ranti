"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import type { OnboardingStatus } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { validateBailForm, type BailFormInput } from "./validation"

// Prise en main guidée : le propriétaire choisit de suivre l'accueil (guided),
// de passer (exploring), ou termine (done). Colonne non-identité → update direct
// sous RLS (landlords_update_own), aucun RPC requis (ADR-002). Jamais bloquant :
// une erreur DB ne casse pas le tableau de bord, elle est seulement journalisée.
const SETTABLE_STATUS: readonly OnboardingStatus[] = ["guided", "exploring", "done"]

export async function setOnboardingStatus(next: OnboardingStatus): Promise<void> {
  if (!SETTABLE_STATUS.includes(next)) return

  const landlord = await requireLandlordProfile()
  const supabase = await createClient()

  const { error } = await supabase
    .from("landlords")
    .update({ onboarding_status: next })
    .eq("id", landlord.id)

  if (error) {
    console.error("setOnboardingStatus: update failed", error.code, error.message)
  }

  revalidatePath("/dashboard")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

// error.code = SQLSTATE remonté par la RPC ; message = "row N: <détail>".
function mapRpcError(error: { code?: string; message?: string }): string {
  const message = error.message ?? ""
  const match = message.match(/row (\d+):/)
  const prefix = match ? `Ligne ${match[1]} : ` : ""

  switch (error.code) {
    case "23505":
      return `${prefix}un logement porte déjà ce nom dans ce lieu.`
    case "23P01":
      return `${prefix}ce logement a déjà un bail actif sur cette période.`
    case "23514":
      return `${prefix}valeur invalide (loyer ou jour d'échéance).`
    case "PR400":
      return "Renseignez le lieu : donnez-lui un nom (2 caractères min.) ou choisissez-en un existant."
    case "P0002":
      return "Lieu introuvable."
    case "P0001":
      return "Ajoutez au moins un logement."
    default:
      return `${prefix}enregistrement impossible. Vérifiez les lignes et réessayez.`
  }
}

// Écran unique « Créer un bail » (ADR-020) : lieu (créé inline OU pioché) +
// logement + occupant + bail, en un geste atomique → échéances générées. Une
// seule RPC (bulk_onboard_portfolio étendue). Redirect-based comme createLease :
// erreurs renvoyées via ?error=.
export async function createBail(formData: FormData) {
  await requireLandlordProfile()

  const input: BailFormInput = {
    propertyMode: asString(formData.get("property_mode")),
    propertyId: asString(formData.get("property_id")),
    propertyName: asString(formData.get("property_name")),
    propertyCity: asString(formData.get("property_city")),
    unitName: asString(formData.get("unit_name")),
    unitType: asString(formData.get("unit_type")),
    firstName: asString(formData.get("first_name")),
    lastName: asString(formData.get("last_name")),
    phone: asString(formData.get("phone")),
    email: asString(formData.get("email")),
    monthlyRentAmount: asString(formData.get("monthly_rent_amount")),
    dueDay: asString(formData.get("due_day")),
    startDate: asString(formData.get("start_date")),
  }

  const back = (message: string): never =>
    redirect(`/leases/new?error=${encodeURIComponent(message)}`)

  const result = validateBailForm(input)
  if (!result.ok) return back(result.formError)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("bulk_onboard_portfolio", {
    p_property: result.property,
    p_rows: [result.row],
  })

  if (error) {
    console.error("createBail: RPC failed", error.code, error.message)
    return back(mapRpcError(error))
  }

  const leaseIds = ((data ?? {}) as { lease_ids?: string[] }).lease_ids ?? []

  revalidatePath("/dashboard")
  revalidatePath("/leases")
  revalidatePath("/units")

  redirect(
    leaseIds[0]
      ? `/leases/${leaseIds[0]}?notice=bail_created`
      : "/leases?notice=bail_created",
  )
}
