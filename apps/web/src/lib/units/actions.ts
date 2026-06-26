"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import {
  normalizeOptionalUnitText,
  normalizeUnitName,
  normalizeUnitType,
} from "./validation"

function unitError(message: string): never {
  redirect(`/units/new?error=${encodeURIComponent(message)}`)
}

export async function createUnit(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const propertyId = formData.get("property_id")
  const name = normalizeUnitName(formData.get("name"))
  const unitType = normalizeUnitType(formData.get("unit_type"))
  const notes = normalizeOptionalUnitText(formData.get("notes"), 500)

  if (typeof propertyId !== "string" || !propertyId) {
    unitError("Choisissez le lieu de ce logement.")
  }

  if (!name) {
    unitError("Donnez un nom simple a ce logement.")
  }

  if (!unitType) {
    unitError("Choisissez le type de logement.")
  }

  const supabase = await createClient()

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!property) {
    unitError("Lieu introuvable. Creez d'abord un lieu.")
  }

  const { error } = await supabase.from("units").insert({
    landlord_id: landlord.id,
    property_id: propertyId,
    name,
    unit_type: unitType,
    availability_status: "available",
    notes,
  })

  if (error) {
    unitError("Impossible de creer ce logement. Reessayez.")
  }

  revalidatePath("/dashboard")
  redirect("/dashboard?notice=unit_created")
}
