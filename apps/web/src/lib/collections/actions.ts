"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import type { CollectionAllocation } from "./types"

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v ? v : null
}

function readAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null
  const raw = value.replace(/\s/g, "")
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Allocations come as parallel fields: allocation_due_id[] + allocation_amount[].
function readAllocations(formData: FormData): CollectionAllocation[] {
  const dueIds = formData.getAll("allocation_due_id")
  const amounts = formData.getAll("allocation_amount")

  const allocations: CollectionAllocation[] = []
  dueIds.forEach((dueId, i) => {
    const amount = readAmount(amounts[i] ?? null)
    if (typeof dueId === "string" && dueId && amount) {
      allocations.push({ rent_due_id: dueId, amount_allocated: amount })
    }
  })
  return allocations
}

function collectionErrorMessage(message: string): string {
  if (message.includes("allocations_exceed")) return "La somme allouée dépasse le montant reçu."
  if (message.includes("amount_invalid")) return "Indiquez un montant valide."
  if (message.includes("method_invalid")) return "Méthode de paiement invalide."
  if (message.includes("due_tenant_mismatch")) return "Une échéance ne correspond pas à ce locataire."
  if (message.includes("due_cancelled")) return "Une échéance annulée ne peut pas être encaissée."
  if (message.includes("not_found")) return "Donnée introuvable."
  return "Encaissement impossible. Réessayez."
}

/**
 * Records an encaissement and confirms it immediately (the owner declaring the
 * receipt is the human validation — Principle 4). The fast "encaisser" path.
 */
export async function recordCollection(formData: FormData) {
  await requireLandlordProfile()

  const tenantId = readString(formData, "tenant_id")
  const unitId = readString(formData, "unit_id")
  const amount = readAmount(formData.get("amount_received"))
  const method = readString(formData, "payment_method")
  const note = readString(formData, "note")
  const allocations = readAllocations(formData)

  const back = (msg: string): never =>
    redirect(`/dashboard?error=${encodeURIComponent(msg)}`)

  if (!tenantId || !unitId) back("Locataire ou logement manquant.")
  if (!amount) back("Indiquez le montant encaissé.")
  if (!method) back("Choisissez la méthode de paiement.")

  const supabase = await createClient()

  const { data: receptionId, error } = await supabase.rpc("record_collection", {
    p_tenant_id: tenantId,
    p_unit_id: unitId,
    p_amount: amount,
    p_method: method,
    p_received_at: null,
    p_note: note,
    p_allocations: allocations,
  })

  if (error || !receptionId) {
    back(collectionErrorMessage(error?.message ?? ""))
  }

  // Confirm right away (fast path). A failed confirm leaves a recoverable draft.
  const { error: confirmError } = await supabase.rpc("confirm_collection", {
    p_reception_id: receptionId,
  })

  if (confirmError) {
    redirect(`/dashboard?notice=collection_recorded_unconfirmed`)
  }

  revalidatePath("/dashboard")
  redirect(`/dashboard?notice=collection_confirmed`)
}

export async function confirmCollection(formData: FormData) {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) redirect(`/dashboard?error=${encodeURIComponent("Encaissement introuvable.")}`)

  const supabase = await createClient()
  const { error } = await supabase.rpc("confirm_collection", { p_reception_id: id })

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent("Confirmation impossible. Réessayez.")}`)
  }

  revalidatePath("/dashboard")
  redirect(`/dashboard?notice=collection_confirmed`)
}

export async function cancelCollection(formData: FormData) {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) redirect(`/dashboard?error=${encodeURIComponent("Encaissement introuvable.")}`)

  const reason = readString(formData, "reason")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_collection", {
    p_reception_id: id,
    p_reason: reason,
  })

  if (error) {
    const message = error.message.includes("has_receipt")
      ? "Impossible : une quittance a déjà été générée."
      : "Annulation impossible. Réessayez."
    redirect(`/dashboard?error=${encodeURIComponent(message)}`)
  }

  revalidatePath("/dashboard")
  redirect(`/dashboard?notice=collection_cancelled`)
}
