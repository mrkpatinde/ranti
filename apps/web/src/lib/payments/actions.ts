"use server"

// ADR-018 v2 — Validation d'une transaction PSP par le PROPRIÉTAIRE.
// verified = la validation humaine (ADR-017) : c'est elle qui déclenche
// réception → confirmation → quittance, atomiquement, via la RPC
// verify_payment_transaction (SECURITY DEFINER, garde d'appartenance,
// accordée à authenticated).

import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { paymentErrorCodeFromMessage, paymentErrorMessage } from "./errors"

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

export async function verifyPaymentTransaction(formData: FormData) {
  await requireLandlordProfile()

  const transactionId = readString(formData, "transaction_id")

  const back = (msg: string): never =>
    redirect(`/collections?error=${encodeURIComponent(msg)}`)

  if (!transactionId) back("Transaction introuvable.")

  const supabase = await createClient()

  const { data: receptionId, error } = await supabase.rpc(
    "verify_payment_transaction",
    { p_transaction_id: transactionId },
  )

  if (error) {
    if (error.message.includes("DUPLICATE_PAYMENT")) {
      back("Cet encaissement a déjà été enregistré (référence déjà utilisée).")
    }
    back(paymentErrorMessage(paymentErrorCodeFromMessage(error.message)))
  }

  // Mêmes surfaces que les encaissements manuels : tout le flux argent.
  revalidateMoneySurfaces()

  // receptionId null = la RPC a re-rejeté (bail devenu inactif / montant).
  if (!receptionId) {
    redirect(`/collections?notice=payment_transaction_rejected`)
  }

  redirect(`/collections?notice=payment_transaction_verified`)
}
