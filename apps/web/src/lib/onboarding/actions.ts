"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import {
  validateBulkOnboarding,
  type BulkRawRow,
  type BulkShared,
  type RowError,
} from "./validation"

export type BulkOnboardState = {
  formError?: string
  rowErrors?: RowError[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function toRawRow(value: unknown): BulkRawRow {
  const r = (value ?? {}) as Record<string, unknown>
  return {
    unitName: asString(r.unitName),
    firstName: asString(r.firstName),
    lastName: asString(r.lastName),
    phone: asString(r.phone),
    email: asString(r.email),
    monthlyRentAmount: asString(r.monthlyRentAmount),
    startDate: asString(r.startDate),
  }
}

// error.code = SQLSTATE remonté par la RPC ; message = "row N: <détail>".
function mapRpcError(error: { code?: string; message?: string }): string {
  const message = error.message ?? ""
  const match = message.match(/row (\d+):/)
  const prefix = match ? `Ligne ${match[1]} : ` : ""

  switch (error.code) {
    case "23505":
      return `${prefix}un logement porte déjà ce nom dans cette propriété.`
    case "23P01":
      return `${prefix}ce logement a déjà un bail actif sur cette période.`
    case "23514":
      return `${prefix}valeur invalide (loyer ou jour d'échéance).`
    case "P0002":
      return "Propriété introuvable."
    case "P0001":
      return "Ajoutez au moins un logement."
    default:
      return `${prefix}enregistrement impossible. Vérifiez les lignes et réessayez.`
  }
}

// Création d'un logement DÉJÀ OCCUPÉ en un seul écran (ADR-016) : logement +
// locataire + bail actif, sans ressortir créer chacun séparément. Réutilise la
// validation et la RPC atomique de l'onboarding groupé avec une seule ligne —
// aucun chemin d'écriture parallèle. Redirect-based (comme createUnit).
export async function createOccupiedUnit(formData: FormData) {
  await requireLandlordProfile()

  const propertyId = asString(formData.get("property_id"))

  const back = (message: string): never =>
    redirect(
      `/units/new?occupied=1&error=${encodeURIComponent(message)}` +
        (propertyId ? `&property_id=${encodeURIComponent(propertyId)}` : ""),
    )

  const shared: BulkShared = {
    propertyId,
    unitType: asString(formData.get("unit_type")),
    dueDay: asString(formData.get("due_day")),
  }

  const row: BulkRawRow = {
    unitName: asString(formData.get("name")),
    firstName: asString(formData.get("first_name")),
    lastName: asString(formData.get("last_name")),
    phone: asString(formData.get("phone")),
    email: asString(formData.get("email")),
    monthlyRentAmount: asString(formData.get("monthly_rent_amount")),
    startDate: asString(formData.get("start_date")),
  }

  const result = validateBulkOnboarding(shared, [row])
  if (!result.ok) {
    back(result.formError ?? result.rowErrors[0]?.message ?? "Vérifiez les champs et réessayez.")
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("bulk_onboard_portfolio", {
    p_property_id: shared.propertyId,
    p_rows: (result as { ok: true; rows: unknown[] }).rows,
  })

  if (error) {
    console.error("createOccupiedUnit: RPC failed", error.code, error.message)
    back(mapRpcError(error))
  }

  revalidatePath("/dashboard")
  revalidatePath("/units")
  revalidatePath("/leases")
  redirect("/leases?notice=unit_occupied_created")
}

export async function bulkOnboard(
  _prev: BulkOnboardState,
  formData: FormData,
): Promise<BulkOnboardState> {
  await requireLandlordProfile()

  const shared: BulkShared = {
    propertyId: asString(formData.get("property_id")),
    unitType: asString(formData.get("unit_type")),
    dueDay: asString(formData.get("due_day")),
  }

  let rawRows: BulkRawRow[]
  try {
    const parsed = JSON.parse(asString(formData.get("rows")) || "[]")
    if (!Array.isArray(parsed)) throw new Error("rows is not an array")
    rawRows = parsed.map(toRawRow)
  } catch {
    return { formError: "Données du formulaire invalides. Réessayez." }
  }

  const result = validateBulkOnboarding(shared, rawRows)
  if (!result.ok) {
    return { formError: result.formError, rowErrors: result.rowErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("bulk_onboard_portfolio", {
    p_property_id: shared.propertyId,
    p_rows: result.rows,
  })

  if (error) {
    console.error("bulkOnboard: RPC failed", error.code, error.message)
    return { formError: mapRpcError(error) }
  }

  const counts = (data ?? {}) as { units?: number; leases?: number }

  revalidatePath("/dashboard")
  revalidatePath("/units")
  revalidatePath("/leases")

  redirect(
    `/leases?notice=bulk_created&units=${counts.units ?? 0}&leases=${counts.leases ?? 0}`,
  )
}
