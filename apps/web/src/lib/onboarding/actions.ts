"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { readRequestId } from "@/lib/idempotency"
import { requireLandlordProfile } from "@/lib/landlords"
import type { OnboardingStatus } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { validateBailForm, type BailFormInput, type BailRowInput } from "./validation"

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

// La ligne fautive remontée par la RPC ("row N: …", 1-indexée) → index 0-based
// pour surligner la bonne carte dans le formulaire.
function rpcErrorRow(error: { message?: string }): number | null {
  const match = (error.message ?? "").match(/row (\d+):/)
  return match ? Number.parseInt(match[1], 10) - 1 : null
}

// Retour d'action du formulaire bail (useActionState) : en cas d'échec, le
// message, la ligne fautive ET les valeurs saisies reviennent au client — le
// propriétaire ne retape jamais ses champs (réseau instable, Android terrain).
export type BailFormState = {
  error: string | null
  errorRow: number | null
  values: BailFormInput | null
}

// Chaque ligne du formulaire soumet TOUS ses champs (les lignes libres portent
// des inputs cachés vides) : les getAll() restent alignés par index.
function readRows(formData: FormData): BailRowInput[] {
  const get = (name: string): string[] => formData.getAll(name).map(asString)
  const occupied = get("occupied")
  const unitName = get("unit_name")
  const unitType = get("unit_type")
  const firstName = get("first_name")
  const lastName = get("last_name")
  const phone = get("phone")
  const email = get("email")
  const monthlyRentAmount = get("monthly_rent_amount")
  const dueDay = get("due_day")
  const startDate = get("start_date")

  return unitName.map((_, i) => ({
    occupied: occupied[i] ?? "1",
    unitName: unitName[i] ?? "",
    unitType: unitType[i] ?? "",
    firstName: firstName[i] ?? "",
    lastName: lastName[i] ?? "",
    phone: phone[i] ?? "",
    email: email[i] ?? "",
    monthlyRentAmount: monthlyRentAmount[i] ?? "",
    dueDay: dueDay[i] ?? "",
    startDate: startDate[i] ?? "",
  }))
}

// Écran unique « Créer un bail » (ADR-020, étendu #166) : lieu (créé inline OU
// pioché) + N logements — occupés (bail activé + échéances) ou encore libres —
// en un geste atomique via l'unique RPC bulk_onboard_portfolio. Succès →
// redirect ; échec → BailFormState (la saisie de toutes les lignes est
// préservée, la ligne fautive surlignée).
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
    rows: readRows(formData),
  }

  const fail = (message: string, errorRow: number | null): BailFormState => ({
    error: message,
    errorRow,
    values: input,
  })

  const result = validateBailForm(input)
  if (!result.ok) return fail(result.formError, result.rowIndex)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("bulk_onboard_portfolio", {
    p_property: result.property,
    p_rows: result.rows,
    // #167 : rejouer ce POST renvoie le MÊME récap — jamais de doublons.
    p_request_id: readRequestId(formData),
  })

  if (error) {
    console.error("createBail: RPC failed", error.code, error.message)
    return fail(mapRpcError(error), rpcErrorRow(error))
  }

  const summary = (data ?? {}) as {
    lease_ids?: string[]
    units?: number
    leases?: number
  }
  const leaseIds = summary.lease_ids ?? []

  // Ce flux active des baux et génère des échéances : purge globale des
  // surfaces (dont /units et /tenants) via le helper central.
  revalidateMoneySurfaces()

  // Mono-ligne occupée : la fiche du bail créé (comportement historique).
  // Lot : récap chiffré sur la liste des baux ; lot 100 % libre : la liste
  // des logements (c'est là que vivent les logements sans bail).
  if (input.rows.length === 1 && leaseIds[0]) {
    redirect(`/leases/${leaseIds[0]}?notice=bail_created`)
  }
  if (leaseIds.length === 0) {
    redirect("/units?notice=bulk_units_created")
  }
  redirect(
    `/leases?notice=bulk_created&units=${summary.units ?? input.rows.length}&leases=${summary.leases ?? leaseIds.length}`,
  )
}
