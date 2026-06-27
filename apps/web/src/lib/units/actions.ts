"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { getUnit } from "./queries"
import {
  normalizeAvailability,
  normalizeOptionalUnitText,
  normalizeUnitName,
  normalizeUnitType,
} from "./validation"

function unitError(message: string): never {
  redirect(`/units/new?error=${encodeURIComponent(message)}`)
}

function readUnitId(formData: FormData): string | null {
  const id = formData.get("id")
  return typeof id === "string" && id ? id : null
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

export async function updateUnit(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readUnitId(formData)
  if (!id) {
    redirect(`/units?error=${encodeURIComponent("Logement introuvable.")}`)
  }

  const existing = await getUnit(landlord.id, id)
  if (!existing) {
    redirect(`/units?error=${encodeURIComponent("Logement introuvable.")}`)
  }

  const name = normalizeUnitName(formData.get("name"))
  const unitType = normalizeUnitType(formData.get("unit_type"))
  const notes = normalizeOptionalUnitText(formData.get("notes"), 500)

  if (!name) {
    redirect(`/units/${id}/edit?error=${encodeURIComponent("Donnez un nom simple a ce logement.")}`)
  }

  if (!unitType) {
    redirect(`/units/${id}/edit?error=${encodeURIComponent("Choisissez le type de logement.")}`)
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("units")
    .update({ name, unit_type: unitType, notes })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    // unique (property_id, name)
    const message =
      error.code === "23505"
        ? "Un logement porte deja ce nom dans ce lieu."
        : "Impossible d'enregistrer. Reessayez."
    redirect(`/units/${id}/edit?error=${encodeURIComponent(message)}`)
  }

  revalidatePath("/dashboard")
  revalidatePath(`/units/${id}`)
  redirect(`/units/${id}?notice=unit_updated`)
}

export async function setUnitAvailability(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readUnitId(formData)
  if (!id) {
    redirect(`/units?error=${encodeURIComponent("Logement introuvable.")}`)
  }

  const availability = normalizeAvailability(formData.get("availability_status"))
  if (!availability) {
    redirect(`/units/${id}?error=${encodeURIComponent("Statut invalide.")}`)
  }

  const existing = await getUnit(landlord.id, id)
  if (!existing) {
    redirect(`/units?error=${encodeURIComponent("Logement introuvable.")}`)
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("units")
    .update({ availability_status: availability })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/units/${id}?error=${encodeURIComponent("Impossible de changer le statut. Reessayez.")}`)
  }

  revalidatePath("/dashboard")
  revalidatePath(`/units/${id}`)
  redirect(`/units/${id}?notice=availability_updated`)
}

export async function archiveUnit(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readUnitId(formData)
  if (!id) {
    redirect(`/units?error=${encodeURIComponent("Logement introuvable.")}`)
  }

  const existing = await getUnit(landlord.id, id)
  if (!existing) {
    redirect(`/units?error=${encodeURIComponent("Logement introuvable.")}`)
  }

  const supabase = await createClient()

  // Refuse archiving while an active lease still references this unit.
  const { data: activeLeases } = await supabase
    .from("leases")
    .select("id")
    .eq("landlord_id", landlord.id)
    .eq("unit_id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1)
  if (activeLeases && activeLeases.length > 0) {
    redirect(`/units/${id}?error=${encodeURIComponent("Ce logement a un bail actif. Terminez le bail avant d'archiver.")}`)
  }

  // Soft-delete only; history is preserved (api.md Units, architecture-principles #12).
  const { error } = await supabase
    .from("units")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/units/${id}?error=${encodeURIComponent("Impossible d'archiver. Reessayez.")}`)
  }

  revalidatePath("/dashboard")
  revalidatePath("/units")
  redirect(`/units?notice=unit_archived`)
}
