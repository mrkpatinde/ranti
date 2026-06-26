"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { getTenant } from "@/lib/tenants"
import { getUnit } from "@/lib/units"
import { createClient } from "@/lib/supabase/server"
import { getLease } from "./queries"
import {
  normalizeCurrency,
  normalizeDate,
  normalizeDueDay,
  normalizeOptionalLeaseText,
  normalizeRentAmount,
} from "./validation"

function readLeaseId(formData: FormData): string | null {
  const id = formData.get("id")
  return typeof id === "string" && id ? id : null
}

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v ? v : null
}

const OVERLAP = "Ce logement a déjà un bail actif sur cette période."

export async function createLease(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const err = (message: string): never =>
    redirect(`/leases/new?error=${encodeURIComponent(message)}`)

  const unitId = readString(formData, "unit_id")
  const tenantId = readString(formData, "tenant_id")
  const amount = normalizeRentAmount(formData.get("monthly_rent_amount"))
  const dueDay = normalizeDueDay(formData.get("due_day"))
  const startDate = normalizeDate(formData.get("start_date"))
  const endDateRaw = formData.get("end_date")
  const endDate = endDateRaw ? normalizeDate(endDateRaw) : null
  const currency = normalizeCurrency(formData.get("currency"))
  const notes = normalizeOptionalLeaseText(formData.get("notes"), 500)

  if (!unitId) err("Choisissez le logement concerné.")
  if (!tenantId) err("Choisissez le locataire.")
  if (!amount) err("Indiquez un loyer mensuel valide (montant positif).")
  if (!dueDay) err("Le jour d'échéance doit être compris entre 1 et 31.")
  if (!startDate) err("Indiquez une date de début valide.")
  if (endDateRaw && !endDate) err("La date de fin n'est pas valide.")
  if (endDate && endDate < startDate!) err("La date de fin doit suivre la date de début.")
  if (!currency) err("Devise non prise en charge (XOF au MVP).")

  // Unit and tenant must belong to the current landlord (api.md Leases).
  const [unit, tenant] = await Promise.all([
    getUnit(landlord.id, unitId!),
    getTenant(landlord.id, tenantId!),
  ])
  if (!unit) err("Logement introuvable.")
  if (!tenant) err("Locataire introuvable.")

  const supabase = await createClient()

  // Created as draft (default). Overlap is enforced on activation.
  const { data, error } = await supabase
    .from("leases")
    .insert({
      landlord_id: landlord.id,
      unit_id: unitId,
      tenant_id: tenantId,
      monthly_rent_amount: amount,
      currency,
      due_day: dueDay,
      start_date: startDate,
      end_date: endDate,
      notes,
    })
    .select("id")
    .single()

  if (error || !data) {
    err("Impossible de créer le bail. Réessayez.")
  }

  revalidatePath("/leases")
  redirect(`/leases/${data!.id}?notice=lease_created`)
}

export async function activateLease(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readLeaseId(formData)
  if (!id) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }

  const lease = await getLease(landlord.id, id)
  if (!lease) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }
  if (lease.status !== "draft") {
    redirect(`/leases/${id}?error=${encodeURIComponent("Ce bail n'est pas en brouillon.")}`)
  }

  const supabase = await createClient()

  // Activation enforces the no-overlapping-active-lease exclusion constraint.
  const { error } = await supabase
    .from("leases")
    .update({ status: "active" })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .eq("status", "draft")

  if (error) {
    const message = error.code === "23P01" ? OVERLAP : "Activation impossible. Réessayez."
    redirect(`/leases/${id}?error=${encodeURIComponent(message)}`)
  }

  // NOTE: rent dues generation on activation is wired in issue #16.
  revalidatePath("/dashboard")
  revalidatePath("/leases")
  revalidatePath(`/leases/${id}`)
  redirect(`/leases/${id}?notice=lease_activated`)
}

export async function endLease(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readLeaseId(formData)
  if (!id) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }

  const lease = await getLease(landlord.id, id)
  if (!lease) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }
  if (lease.status !== "active") {
    redirect(`/leases/${id}?error=${encodeURIComponent("Seul un bail actif peut être terminé.")}`)
  }

  const today = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()

  // History (dues, receptions, receipts) is preserved (api.md Leases).
  const { error } = await supabase
    .from("leases")
    .update({ status: "ended", end_date: lease.end_date ?? today })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .eq("status", "active")

  if (error) {
    redirect(`/leases/${id}?error=${encodeURIComponent("Impossible de terminer le bail. Réessayez.")}`)
  }

  revalidatePath("/dashboard")
  revalidatePath("/leases")
  redirect(`/leases/${id}?notice=lease_ended`)
}

export async function updateLease(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const id = readLeaseId(formData)
  if (!id) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }

  const lease = await getLease(landlord.id, id)
  if (!lease) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }
  // Modifying a lease with existing dues is constrained (api.md): draft only.
  if (lease.status !== "draft") {
    redirect(`/leases/${id}?error=${encodeURIComponent("Un bail activé ne peut plus être modifié librement.")}`)
  }

  const err = (message: string): never =>
    redirect(`/leases/${id}/edit?error=${encodeURIComponent(message)}`)

  const amount = normalizeRentAmount(formData.get("monthly_rent_amount"))
  const dueDay = normalizeDueDay(formData.get("due_day"))
  const startDate = normalizeDate(formData.get("start_date"))
  const endDateRaw = formData.get("end_date")
  const endDate = endDateRaw ? normalizeDate(endDateRaw) : null
  const notes = normalizeOptionalLeaseText(formData.get("notes"), 500)

  if (!amount) err("Indiquez un loyer mensuel valide.")
  if (!dueDay) err("Le jour d'échéance doit être compris entre 1 et 31.")
  if (!startDate) err("Indiquez une date de début valide.")
  if (endDateRaw && !endDate) err("La date de fin n'est pas valide.")
  if (endDate && endDate < startDate!) err("La date de fin doit suivre la date de début.")

  const supabase = await createClient()

  const { error } = await supabase
    .from("leases")
    .update({
      monthly_rent_amount: amount,
      due_day: dueDay,
      start_date: startDate,
      end_date: endDate,
      notes,
    })
    .eq("id", id)
    .eq("landlord_id", landlord.id)
    .eq("status", "draft")

  if (error) {
    err("Impossible d'enregistrer. Réessayez.")
  }

  revalidatePath(`/leases/${id}`)
  redirect(`/leases/${id}?notice=lease_updated`)
}
