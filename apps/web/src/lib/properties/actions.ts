"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { getProperty } from "./queries"
import { normalizeOptionalPropertyText, normalizePropertyName } from "./validation"

function readPropertyId(formData: FormData): string | null {
  const id = formData.get("id")
  return typeof id === "string" && id ? id : null
}

export async function updateProperty(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readPropertyId(formData)
  if (!id) {
    redirect(`/properties?error=${encodeURIComponent("Lieu introuvable.")}`)
  }

  const existing = await getProperty(landlord.id, id)
  if (!existing) {
    redirect(`/properties?error=${encodeURIComponent("Lieu introuvable.")}`)
  }

  const name = normalizePropertyName(formData.get("name"))
  const city = normalizeOptionalPropertyText(formData.get("city"), 80)
  const address = normalizeOptionalPropertyText(formData.get("address"), 160)
  const notes = normalizeOptionalPropertyText(formData.get("notes"), 500)

  if (!name) {
    redirect(`/properties/${id}/edit?error=${encodeURIComponent("Donnez un nom simple à ce lieu.")}`)
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("properties")
    .update({ name, city, address, notes })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/properties/${id}/edit?error=${encodeURIComponent("Impossible d'enregistrer. Réessayez.")}`)
  }

  // Le nom du lieu s'affiche sur les surfaces argent : rafraîchir tout.
  revalidateMoneySurfaces()
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}?notice=property_updated`)
}

export async function archiveProperty(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readPropertyId(formData)
  if (!id) {
    redirect(`/properties?error=${encodeURIComponent("Lieu introuvable.")}`)
  }

  const existing = await getProperty(landlord.id, id)
  if (!existing) {
    redirect(`/properties?error=${encodeURIComponent("Lieu introuvable.")}`)
  }

  const supabase = await createClient()

  const { data: propertyUnits } = await supabase
    .from("units")
    .select("id")
    .eq("landlord_id", landlord.id)
    .eq("property_id", id)
    .is("deleted_at", null)
  const unitIds = (propertyUnits ?? []).map((u) => u.id as string)
  if (unitIds.length > 0) {
    const { data: activeLeases } = await supabase
      .from("leases")
      .select("id")
      .eq("landlord_id", landlord.id)
      .in("unit_id", unitIds)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1)
    if (activeLeases && activeLeases.length > 0) {
      redirect(`/properties/${id}?error=${encodeURIComponent("Un logement de ce lieu a un bail actif. Terminez le bail avant d'archiver.")}`)
    }
  }

  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/properties/${id}?error=${encodeURIComponent("Impossible d'archiver. Réessayez.")}`)
  }

  revalidatePath("/dashboard")
  revalidatePath("/properties")
  redirect(`/properties?notice=property_archived`)
}
