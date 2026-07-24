"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { getTenant } from "./queries"
import {
  isEmail,
  normalizeOptionalTenantText,
  normalizeTenantName,
  normalizeTenantPhone,
} from "./validation"

function readTenantId(formData: FormData): string | null {
  const id = formData.get("id")
  return typeof id === "string" && id ? id : null
}

function withError(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}error=${encodeURIComponent(message)}`
}

type TenantInput = {
  firstName: string
  lastName: string
  phone: string
  email: string | null
  notes: string | null
}

function readTenantInput(formData: FormData, errorPath: string): TenantInput {
  const firstName = normalizeTenantName(formData.get("first_name"))
  const lastName = normalizeTenantName(formData.get("last_name"))
  const phone = normalizeTenantPhone(formData.get("phone"))
  const email = normalizeOptionalTenantText(formData.get("email"), 160)
  const notes = normalizeOptionalTenantText(formData.get("notes"), 500)

  if (!firstName || !lastName) {
    redirect(withError(errorPath, "Indiquez le prénom et le nom du locataire."))
  }

  if (!phone) {
    redirect(withError(errorPath, "Ajoutez le numéro du locataire pour permettre les relances."))
  }

  if (email && !isEmail(email)) {
    redirect(withError(errorPath, "L'adresse email n'est pas valide."))
  }

  return { firstName, lastName, phone, email, notes }
}

export async function updateTenant(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readTenantId(formData)
  if (!id) {
    redirect(`/tenants?error=${encodeURIComponent("Locataire introuvable.")}`)
  }

  const existing = await getTenant(landlord.id, id)
  if (!existing) {
    redirect(`/tenants?error=${encodeURIComponent("Locataire introuvable.")}`)
  }

  const input = readTenantInput(formData, `/tenants/${id}/edit`)

  const supabase = await createClient()

  const { error } = await supabase
    .from("tenants")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/tenants/${id}/edit?error=${encodeURIComponent("Impossible d'enregistrer. Réessayez.")}`)
  }

  // Le nom du locataire s'affiche sur les quittances, le journal et les
  // relances : un renommage doit rafraîchir tout le flux argent.
  revalidateMoneySurfaces()
  redirect(`/tenants/${id}?notice=tenant_updated`)
}

export async function archiveTenant(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readTenantId(formData)
  if (!id) {
    redirect(`/tenants?error=${encodeURIComponent("Locataire introuvable.")}`)
  }

  const existing = await getTenant(landlord.id, id)
  if (!existing) {
    redirect(`/tenants?error=${encodeURIComponent("Locataire introuvable.")}`)
  }

  const supabase = await createClient()

  const { data: activeLeases } = await supabase
    .from("leases")
    .select("id")
    .eq("landlord_id", landlord.id)
    .eq("tenant_id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1)
  if (activeLeases && activeLeases.length > 0) {
    redirect(`/tenants/${id}?error=${encodeURIComponent("Ce locataire a un bail actif. Terminez le bail avant d'archiver.")}`)
  }

  const { error } = await supabase
    .from("tenants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    redirect(`/tenants/${id}?error=${encodeURIComponent("Impossible d'archiver. Réessayez.")}`)
  }

  revalidatePath("/dashboard")
  revalidatePath("/tenants")
  redirect("/tenants?notice=tenant_archived")
}
