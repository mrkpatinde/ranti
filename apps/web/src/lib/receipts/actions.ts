"use server"

import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

// Generate a receipt from a confirmed reception (invariant #3). Idempotent.
export async function generateReceipt(formData: FormData) {
  await requireLandlordProfile()

  const receptionId = readString(formData, "reception_id")
  if (!receptionId) {
    redirect(`/dashboard?error=${encodeURIComponent("Encaissement introuvable.")}`)
  }

  const supabase = await createClient()
  const { data: receiptId, error } = await supabase.rpc("generate_receipt", {
    p_reception_id: receptionId,
  })

  if (error || !receiptId) {
    const message = (error?.message ?? "").includes("not_confirmed")
      ? "Confirmez d'abord l'encaissement."
      : "Génération de la quittance impossible. Réessayez."
    redirect(`/dashboard?error=${encodeURIComponent(message)}`)
  }

  revalidateMoneySurfaces()
  redirect(`/receipts/${receiptId}?notice=receipt_generated`)
}

export async function cancelReceipt(formData: FormData) {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) redirect(`/receipts?error=${encodeURIComponent("Quittance introuvable.")}`)

  const reason = readString(formData, "reason")
  if (!reason) {
    redirect(`/receipts/${id}?error=${encodeURIComponent("Indiquez pourquoi vous annulez cette quittance.")}`)
  }

  const supabase = await createClient()

  // ADR-005 flux 1 — annuler le document SEUL. Ne touche jamais l'encaissement.
  // (Ancienne cascade auto cancel_collection retirée : annuler une quittance
  // ne veut pas dire que l'argent n'a jamais été reçu. Pour retirer l'argent,
  // l'utilisateur annule explicitement l'encaissement — flux 2 cancelCollection.)
  const { error } = await supabase.rpc("cancel_receipt", {
    p_receipt_id: id,
    p_reason: reason,
  })

  if (error) {
    redirect(`/receipts/${id}?error=${encodeURIComponent("Annulation impossible. Réessayez.")}`)
  }

  revalidateMoneySurfaces()
  redirect(`/receipts/${id}?notice=receipt_cancelled`)
}

// ADR-005 flux 3 — remplacer un document : annule l'ancien + génère un nouveau
// document actif lié, de façon atomique côté DB (rpc replace_receipt).
// Ne supprime jamais l'ancien, ne touche jamais l'encaissement.
export async function replaceReceipt(formData: FormData) {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) redirect(`/receipts?error=${encodeURIComponent("Quittance introuvable.")}`)

  const reason = readString(formData, "reason")
  if (!reason) {
    redirect(`/receipts/${id}?error=${encodeURIComponent("Indiquez pourquoi vous remplacez cette quittance.")}`)
  }

  const supabase = await createClient()
  const { data: newId, error } = await supabase.rpc("replace_receipt", {
    p_receipt_id: id,
    p_reason: reason,
  })

  if (error || !newId) {
    const message = (error?.message ?? "").includes("receipt_not_issued")
      ? "Seule une quittance active peut être remplacée."
      : "Remplacement impossible. Réessayez."
    redirect(`/receipts/${id}?error=${encodeURIComponent(message)}`)
  }

  revalidateMoneySurfaces()
  redirect(`/receipts/${newId}?notice=receipt_replaced`)
}
