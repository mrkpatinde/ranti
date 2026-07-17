"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { readRequestId } from "@/lib/idempotency"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"

// Écritures du grand livre côté bailleur (ADR-023, phase « différenciant »).
// Toute la logique métier (matrice de validation, machine à états, motifs,
// idempotence) vit dans les RPC SECURITY DEFINER — l'app ne fait que porter
// le formulaire et traduire les erreurs en français.

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

const CHARGE_ERRORS: Record<string, string> = {
  charge_type_invalid: "Choisissez la nature de la charge (réparation ou frais).",
  amount_invalid: "Indiquez un montant valide (entier positif, en FCFA).",
  label_required: "Décrivez la charge en quelques mots.",
  label_too_long: "Le libellé est trop long (120 caractères maximum).",
  lease_not_found: "Bail introuvable.",
  lease_not_active: "Ce bail n'est pas actif — une charge s'ajoute sur un bail en cours.",
  reason_required: "Indiquez le motif (il reste dans l'historique).",
  transaction_not_found: "Charge introuvable.",
  not_withdrawable: "Cette ligne ne se retire pas ici.",
  transaction_terminal:
    "Cette charge a déjà été validée : elle est indélébile. Corrigez-la par contre-passation.",
  DUPLICATE_CHARGE: "Cette charge a déjà été enregistrée.",
}

function chargeError(error: { message: string }): string {
  for (const [code, message] of Object.entries(CHARGE_ERRORS)) {
    if (error.message.includes(code)) return message
  }
  return "Action impossible pour le moment. Réessayez."
}

export async function addLeaseCharge(formData: FormData) {
  await requireLandlordProfile()
  const leaseId = readString(formData, "lease_id")
  if (!leaseId) redirect("/leases")

  const back = (message: string): never =>
    redirect(`/leases/${leaseId}/charges/new?error=${encodeURIComponent(message)}`)

  const type = readString(formData, "type")
  const label = readString(formData, "label")
  const amountRaw = readString(formData, "amount")?.replace(/[\s ]/g, "") ?? ""
  const amount = /^\d+$/.test(amountRaw) ? Number(amountRaw) : null
  const dueDate = readString(formData, "due_date")

  if (!type) back(CHARGE_ERRORS.charge_type_invalid)
  if (!amount || amount <= 0) back(CHARGE_ERRORS.amount_invalid)
  if (!label) back(CHARGE_ERRORS.label_required)

  const supabase = await createClient()
  const { error } = await supabase.rpc("add_lease_charge", {
    p_lease_id: leaseId,
    p_type: type,
    p_amount: amount,
    p_label: label,
    p_due_date: dueDate,
    p_request_id: readRequestId(formData),
  })

  if (error) back(chargeError(error))

  revalidatePath(`/leases/${leaseId}`)
  revalidatePath("/dashboard")
  redirect(`/leases/${leaseId}?notice=charge_added`)
}

export async function withdrawLedgerLine(formData: FormData) {
  await requireLandlordProfile()
  const leaseId = readString(formData, "lease_id")
  const id = readString(formData, "id")
  if (!leaseId || !id) redirect("/leases")

  const reason = readString(formData, "reason")
  if (!reason) {
    redirect(`/leases/${leaseId}?error=${encodeURIComponent(CHARGE_ERRORS.reason_required)}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("withdraw_ledger_line", {
    p_transaction_id: id,
    p_reason: reason,
  })

  if (error) {
    redirect(`/leases/${leaseId}?error=${encodeURIComponent(chargeError(error))}`)
  }

  revalidatePath(`/leases/${leaseId}`)
  revalidatePath("/dashboard")
  redirect(`/leases/${leaseId}?notice=charge_withdrawn`)
}

export async function replaceLedgerCharge(formData: FormData) {
  await requireLandlordProfile()
  const leaseId = readString(formData, "lease_id")
  const id = readString(formData, "id")
  if (!leaseId || !id) redirect("/leases")

  const back = (message: string): never =>
    redirect(
      `/leases/${leaseId}/charges/${id}/corriger?error=${encodeURIComponent(message)}`,
    )

  const label = readString(formData, "label")
  const amountRaw = readString(formData, "amount")?.replace(/[\s ]/g, "") ?? ""
  const amount = /^\d+$/.test(amountRaw) ? Number(amountRaw) : null
  const dueDate = readString(formData, "due_date")
  const reason = readString(formData, "reason")

  if (!amount || amount <= 0) back(CHARGE_ERRORS.amount_invalid)
  if (!label) back(CHARGE_ERRORS.label_required)

  const supabase = await createClient()
  const { error } = await supabase.rpc("replace_ledger_charge", {
    p_transaction_id: id,
    p_amount: amount,
    p_label: label,
    p_due_date: dueDate,
    p_reason: reason,
  })

  if (error) back(chargeError(error))

  revalidatePath(`/leases/${leaseId}`)
  revalidatePath("/dashboard")
  redirect(`/leases/${leaseId}?notice=charge_replaced`)
}
