"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { validateBailForm, type BailFormInput } from "./validation"

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

// Retour d'action du formulaire bail (useActionState) : en cas d'échec, le
// message ET les valeurs saisies reviennent au client — le propriétaire ne
// retape jamais ses 8 champs (réseau instable, Android terrain).
export type BailFormState = {
  error: string | null
  values: BailFormInput | null
}

// Écran unique « Créer un bail » (ADR-020) : lieu (créé inline OU pioché) +
// logement + occupant + bail, en un geste atomique → échéances générées. Une
// seule RPC (bulk_onboard_portfolio étendue). Succès → redirect ; échec →
// BailFormState (la saisie est préservée).
export async function createBail(
  _prev: BailFormState,
  formData: FormData,
): Promise<BailFormState> {
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

  const fail = (message: string): BailFormState => ({ error: message, values: input })

  const result = validateBailForm(input)
  if (!result.ok) return fail(result.formError)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("bulk_onboard_portfolio", {
    p_property: result.property,
    p_rows: [result.row],
  })

  if (error) {
    console.error("createBail: RPC failed", error.code, error.message)
    return fail(mapRpcError(error))
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
