"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { isEmail } from "@/lib/tenants/validation"
import { getOwner, getOwnerProperties } from "./queries"
import {
  normalizeOptionalOwnerText,
  normalizeOwnerName,
  normalizeOwnerPhone,
  parseFeePercent,
} from "./validation"

function withError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?"
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`)
}

function readOwnerId(formData: FormData): string | null {
  const id = formData.get("id")
  return typeof id === "string" && id ? id : null
}

type OwnerInput = {
  displayName: string
  phone: string | null
  email: string | null
  feeRateBp: number
  notes: string | null
}

function readOwnerInput(formData: FormData, errorPath: string): OwnerInput {
  const displayName = normalizeOwnerName(formData.get("display_name"))
  const phone = normalizeOwnerPhone(formData.get("phone"))
  const email = normalizeOptionalOwnerText(formData.get("email"), 160)
  const feeRateBp = parseFeePercent(formData.get("fee_rate_percent"))
  const notes = normalizeOptionalOwnerText(formData.get("notes"), 500)

  if (!displayName) {
    withError(errorPath, "Indiquez le nom du propriétaire (2 caractères minimum).")
  }
  if (email && !isEmail(email)) {
    withError(errorPath, "L'adresse e-mail n'est pas valide.")
  }
  if (feeRateBp === null) {
    withError(errorPath, "Taux d'honoraires invalide : un nombre entre 0 et 100, par exemple 8,5.")
  }

  return { displayName, phone, email, feeRateBp, notes }
}

function isDuplicateName(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" && (error.message ?? "").includes("owners_landlord_name_unique")
}

export async function createOwner(formData: FormData) {
  const landlord = await requireLandlordProfile()
  const input = readOwnerInput(formData, "/owners/new")

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("owners")
    .insert({
      landlord_id: landlord.id,
      display_name: input.displayName,
      phone: input.phone,
      email: input.email,
      fee_rate_bp: input.feeRateBp,
      notes: input.notes,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    if (isDuplicateName(error)) {
      withError("/owners/new", "Un propriétaire porte déjà ce nom dans votre portefeuille.")
    }
    console.error("createOwner failed", error.code, error.message)
    withError("/owners/new", "Enregistrement impossible. Réessayez.")
  }

  revalidatePath("/owners")
  redirect(`/owners/${data?.id ?? ""}?notice=owner_created`)
}

export async function updateOwner(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readOwnerId(formData)
  if (!id) {
    withError("/owners", "Propriétaire introuvable.")
  }

  const existing = await getOwner(landlord.id, id)
  if (!existing) {
    withError("/owners", "Propriétaire introuvable.")
  }

  const input = readOwnerInput(formData, `/owners/${id}/edit`)

  const supabase = await createClient()

  const { error } = await supabase
    .from("owners")
    .update({
      display_name: input.displayName,
      phone: input.phone,
      email: input.email,
      fee_rate_bp: input.feeRateBp,
      notes: input.notes,
    })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    if (isDuplicateName(error)) {
      withError(`/owners/${id}/edit`, "Un propriétaire porte déjà ce nom dans votre portefeuille.")
    }
    console.error("updateOwner failed", error.code, error.message)
    withError(`/owners/${id}/edit`, "Enregistrement impossible. Réessayez.")
  }

  // Le taux d'honoraires change le net à reverser affiché sur la clôture.
  revalidatePath("/owners")
  revalidatePath(`/owners/${id}`)
  redirect(`/owners/${id}?notice=owner_updated`)
}

/**
 * Archivage logique. Un mandant qui gère encore des biens n'est pas archivé :
 * le rattachement des biens doit être tranché d'abord, sinon leurs relevés
 * pointeraient vers un mandant disparu. Même garde que l'archivage d'un lieu
 * dont un logement a un bail actif.
 */
export async function archiveOwner(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readOwnerId(formData)
  if (!id) {
    withError("/owners", "Propriétaire introuvable.")
  }

  const existing = await getOwner(landlord.id, id)
  if (!existing) {
    withError("/owners", "Propriétaire introuvable.")
  }

  const properties = await getOwnerProperties(landlord.id, id)
  if (properties.length > 0) {
    withError(
      `/owners/${id}`,
      properties.length === 1
        ? "Ce propriétaire a encore un bien rattaché. Modifiez le bien avant d'archiver."
        : `Ce propriétaire a encore ${properties.length} biens rattachés. Modifiez-les avant d'archiver.`,
    )
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("owners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .is("deleted_at", null)

  if (error) {
    console.error("archiveOwner failed", error.code, error.message)
    withError(`/owners/${id}`, "Impossible d'archiver. Réessayez.")
  }

  revalidatePath("/owners")
  redirect("/owners?notice=owner_archived")
}
