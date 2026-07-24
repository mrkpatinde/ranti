"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { getUnit } from "./queries"
import {
  normalizeAvailability,
  normalizeOptionalUnitText,
  normalizeUnitName,
  normalizeUnitType,
} from "./validation"

function readUnitId(formData: FormData): string | null {
  const id = formData.get("id")
  return typeof id === "string" && id ? id : null
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
    redirect(`/units/${id}/edit?error=${encodeURIComponent("Donnez un nom simple à ce logement.")}`)
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
    const message =
      error.code === "23505"
        ? "Un logement porte déjà ce nom dans ce lieu."
        : "Impossible d'enregistrer. Réessayez."
    redirect(`/units/${id}/edit?error=${encodeURIComponent(message)}`)
  }

  // Le nom du logement s'affiche sur les surfaces argent : rafraîchir tout.
  revalidateMoneySurfaces()
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
    redirect(`/units/${id}?error=${encodeURIComponent("Impossible de changer le statut. Réessayez.")}`)
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

  const { error } = await supabase
    .from("units")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/units/${id}?error=${encodeURIComponent("Impossible d'archiver. Réessayez.")}`)
  }

  revalidatePath("/dashboard")
  revalidatePath("/units")
  redirect(`/units?notice=unit_archived`)
}
