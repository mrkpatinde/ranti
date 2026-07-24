"use server"

import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { readRequestId } from "@/lib/idempotency"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import type { CollectionAllocation } from "./types"

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function readAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null
  const raw = value.replace(/\s/g, "")
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

function readAllocations(formData: FormData): CollectionAllocation[] {
  const dueIds = formData.getAll("allocation_due_id")
  const amounts = formData.getAll("allocation_amount")

  if (dueIds.length !== amounts.length) return []

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
  if (message.includes("DUPLICATE_PAYMENT")) return "Cet encaissement a déjà été enregistré."
  if (message.includes("allocations_exceed")) return "La somme allouée dépasse le montant reçu."
  if (message.includes("allocation_exceeds_due")) return "Une allocation dépasse le reste dû de l'échéance."
  if (message.includes("allocation_required")) return "Affectez l'encaissement à au moins une échéance."
  if (message.includes("amount_invalid")) return "Indiquez un montant valide."
  if (message.includes("method_invalid")) return "Méthode de paiement invalide."
  if (message.includes("due_unit_mismatch")) return "Une échéance ne correspond pas au logement encaissé."
  if (message.includes("due_tenant_mismatch")) return "Une échéance ne correspond pas à ce locataire."
  if (message.includes("due_cancelled")) return "Une échéance annulée ne peut pas être encaissée."
  if (message.includes("not_found")) return "Donnée introuvable."
  console.error("[collections] unmapped RPC error:", message)
  return "Encaissement impossible. Réessayez."
}

async function generateDocumentForConfirmedCollection(receptionId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: receiptId, error } = await supabase.rpc("generate_receipt", {
    p_reception_id: receptionId,
  })

  if (error) console.error("[collections] generate_receipt failed:", error.message)
  if (error || !receiptId) return null
  return String(receiptId)
}

export async function recordCollection(formData: FormData) {
  await requireLandlordProfile()

  const tenantId = readString(formData, "tenant_id")
  const unitId = readString(formData, "unit_id")
  const amount = readAmount(formData.get("amount_received"))
  const method = readString(formData, "payment_method")
  const note = readString(formData, "note")
  const allocations = readAllocations(formData)

  const back = (msg: string): never =>
    redirect(`/collections?error=${encodeURIComponent(msg)}`)

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
    // #167 : rejouer ce POST (double-clic, réponse perdue) renvoie la MÊME
    // réception — jamais un double encaissement.
    p_request_id: readRequestId(formData),
  })

  if (error || !receptionId) {
    back(collectionErrorMessage(error?.message ?? ""))
  }

  const { error: confirmError } = await supabase.rpc("confirm_collection", {
    p_reception_id: receptionId,
  })

  if (confirmError) {
    const { error: cancelError } = await supabase.rpc("cancel_collection", {
      p_reception_id: receptionId,
      p_reason: "Annulation auto : confirmation échouée à l'enregistrement.",
    })

    if (cancelError) {
      // Double échec (confirmation puis annulation auto) : une réception
      // existe quand même en base, les surfaces doivent la montrer.
      revalidateMoneySurfaces()
      redirect(`/collections?notice=collection_recorded_unconfirmed`)
    }

    back("Encaissement non enregistré (échec de confirmation). Réessayez.")
  }

  const receiptId = await generateDocumentForConfirmedCollection(String(receptionId))

  revalidateMoneySurfaces()

  if (receiptId) {
    redirect(`/receipts/${receiptId}?notice=receipt_generated`)
  }

  redirect(`/collections?notice=collection_confirmed_document_pending`)
}

// Affecter un encaissement Fast-Log déjà confirmé (crédit non alloué, ADR-014)
// à une ou plusieurs échéances. Passe par la RPC allocate_reception, qui
// réutilise les invariants de record_collection (montant ≤ reste dû, somme des
// allocations ≤ montant reçu) et recalcule le statut des échéances. Aucune
// nouvelle réception n'est créée : pas de double comptage.
export async function allocateReception(formData: FormData) {
  await requireLandlordProfile()

  const receptionId = readString(formData, "reception_id")
  const allocations = readAllocations(formData)

  const back = (msg: string): never =>
    redirect(
      receptionId
        ? `/collections/allocate/${receptionId}?error=${encodeURIComponent(msg)}`
        : `/collections?error=${encodeURIComponent(msg)}`,
    )

  if (!receptionId) back("Encaissement introuvable.")
  if (allocations.length === 0) back("Affectez au moins une échéance (montant supérieur à 0).")

  const supabase = await createClient()
  const { error } = await supabase.rpc("allocate_reception", {
    p_reception_id: receptionId,
    p_allocations: allocations,
  })

  if (error) back(collectionErrorMessage(error.message))

  revalidateMoneySurfaces()
  redirect("/dashboard?notice=reception_allocated")
}

// #167 Phase 4 — confirmer/annuler renvoient un ÉTAT au lieu de rediriger :
// la carte encaissement (client, useOptimistic) bascule instantanément et
// revient en arrière d'elle-même si l'action échoue. Succès → revalidation,
// les vraies données (badge, lien du document) remplacent l'optimisme.
export type CollectionActionState = { error: string | null }

export async function confirmCollection(
  _prev: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) return { error: "Encaissement introuvable." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("confirm_collection", { p_reception_id: id })

  if (error) {
    const known = error.message.includes("allocation_exceeds_due_at_confirm")
    if (!known) console.error("[collections] unmapped confirm error:", error.message)
    return {
      error: known
        ? "Confirmation impossible : une autre confirmation a déjà couvert cette échéance."
        : "Confirmation impossible. Réessayez.",
    }
  }

  // ADR-007 : le document se génère dans la foulée ; en cas d'échec la carte
  // confirmée propose « Générer la quittance ou le reçu » (fallback existant).
  await generateDocumentForConfirmedCollection(id)

  revalidateMoneySurfaces()
  return { error: null }
}

export async function cancelCollection(
  _prev: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) return { error: "Encaissement introuvable." }

  const reason = readString(formData, "reason")
  if (!reason) return { error: "Indiquez pourquoi vous annulez cet encaissement." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_collection", {
    p_reception_id: id,
    p_reason: reason,
  })

  if (error) {
    const known = error.message.includes("has_receipt")
    if (!known) console.error("[collections] unmapped cancel error:", error.message)
    return {
      error: known
        ? "Impossible : une quittance a déjà été générée."
        : "Annulation impossible. Réessayez.",
    }
  }

  revalidateMoneySurfaces()
  return { error: null }
}
