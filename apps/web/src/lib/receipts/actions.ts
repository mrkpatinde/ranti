"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
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

  revalidatePath("/dashboard")
  revalidatePath("/receipts")
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
  const { error } = await supabase.rpc("cancel_receipt", {
    p_receipt_id: id,
    p_reason: reason,
  })

  if (error) {
    redirect(`/receipts/${id}?error=${encodeURIComponent("Annulation impossible. Réessayez.")}`)
  }

  revalidatePath("/receipts")
  redirect(`/receipts/${id}?notice=receipt_cancelled`)
}
