"use server"

import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { validateBailForm, type BailFormInput } from "@/lib/onboarding/validation"
import type { ReceiptKind, ReceiptSnapshot } from "@/lib/receipts/types"
import {
  PAYMENT_METHOD_VALUES, fcfa, mapBailError, mapCollectionError, monthLabel,
  parseStrictAmount, validRequestId,
} from "./helpers"

// Phase 3 : actions serveur du parcours FirstRun. Contrairement aux actions
// historiques (createBail, recordCollection, generateReceipt) qui redirigent
// vers /leases/:id ou /receipts/:id, celles-ci RENVOIENT les donnees : le flow
// guide reste sur une seule page et affiche la quittance en place. Elles
// reutilisent les MEMES RPC (bulk_onboard_portfolio, record_collection,
// confirm_collection, generate_receipt) et la MEME validation (validateBailForm),
// donc aucune regle metier n'est dupliquee. Aides pures dans ./helpers
// (un module "use server" ne peut exporter que des fonctions async).

// ── Creer le premier bail (ou un bail supplementaire) ───────────────────────

export type FirstRunBailInput = {
  propertyName: string
  propertyCity: string
  unitName: string
  unitType: string
  firstName: string
  lastName: string
  phone: string
  email: string
  monthlyRentAmount: string
  dueDay: string
  startDate: string
  requestId: string
}

export type FirstRunBailResult =
  | {
      ok: true
      leaseId: string
      unitId: string
      tenantId: string
      dueId: string | null
      dueAmount: number
      tenantName: string
      unitLabel: string
      amountLabel: string
    }
  | { ok: false; error: string }

export async function createBailFirstRun(input: FirstRunBailInput): Promise<FirstRunBailResult> {
  await requireLandlordProfile()

  const form: BailFormInput = {
    propertyMode: "new",
    propertyId: "",
    propertyName: input.propertyName,
    propertyCity: input.propertyCity,
    rows: [
      {
        occupied: "1",
        unitName: input.unitName,
        unitType: input.unitType,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        monthlyRentAmount: input.monthlyRentAmount,
        dueDay: input.dueDay,
        startDate: input.startDate,
      },
    ],
  }

  const validation = validateBailForm(form)
  if (!validation.ok) return { ok: false, error: validation.formError }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("bulk_onboard_portfolio", {
    p_property: validation.property,
    p_rows: validation.rows,
    p_request_id: validRequestId(input.requestId),
  })

  if (error) {
    console.error("createBailFirstRun: RPC failed", error.code, error.message)
    return { ok: false, error: mapBailError(error) }
  }

  const leaseId = ((data ?? {}) as { lease_ids?: string[] }).lease_ids?.[0]
  if (!leaseId) return { ok: false, error: "Bail non cree. Reessayez." }

  // La 1re echeance generee (ADR-004) sert de cible d'allocation au paiement.
  const { data: due } = await supabase
    .from("rent_dues")
    .select("id, unit_id, tenant_id, amount_due")
    .eq("lease_id", leaseId)
    .is("deleted_at", null)
    .order("period_start", { ascending: true })
    .limit(1)
    .maybeSingle()

  // validation.rows / validation.property sont deja normalises (branche ok) :
  // on s'en sert pour des libelles surs.
  const nRow = validation.rows[0]
  const dueAmount = due?.amount_due ?? (Number.parseInt(nRow?.monthly_rent_amount ?? "0", 10) || 0)
  const city = "city" in validation.property ? validation.property.city ?? "" : ""

  return {
    ok: true,
    leaseId,
    unitId: due?.unit_id ?? "",
    tenantId: due?.tenant_id ?? "",
    dueId: due?.id ?? null,
    dueAmount,
    tenantName: `${nRow?.first_name ?? input.firstName} ${nRow?.last_name ?? input.lastName}`.trim(),
    unitLabel: [nRow?.unit_name ?? input.unitName, city].filter(Boolean).join(", "),
    amountLabel: fcfa(dueAmount, "XOF"),
  }
}

// ── Valider un paiement puis editer la quittance reelle ─────────────────────

export type FirstRunPaymentInput = {
  tenantId: string
  unitId: string
  dueId: string | null
  dueAmount: number
  amount: string
  method: string
  receivedAt: string | null
  requestId: string
}

export type FirstRunReceiptView = {
  receiptId: string
  receiptNumber: string
  kind: ReceiptKind
  totalAmount: number
  amountLabel: string
  currency: string
  issuedAt: string
  tenantName: string
  unitLabel: string
  periodLabel: string | null
  verifyRef: string // ranti.app/recu/<token>
  sha256: string | null
  tenantConfirmed: boolean
}

export type FirstRunPaymentResult =
  | { ok: true; receipt: FirstRunReceiptView }
  | { ok: false; error: string }

export async function recordPaymentFirstRun(
  input: FirstRunPaymentInput,
): Promise<FirstRunPaymentResult> {
  await requireLandlordProfile()

  if (!input.tenantId || !input.unitId) return { ok: false, error: "Bail introuvable." }
  const amount = parseStrictAmount(input.amount)
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Indiquez un montant valide." }
  if (!PAYMENT_METHOD_VALUES.has(input.method)) return { ok: false, error: "Methode de paiement invalide." }

  const supabase = await createClient()

  // Alloue a la 1re echeance (<= reste du) : loyer complet => quittance,
  // paiement partiel => recu. Aucune invention : la nature suit les regles DB.
  const allocations =
    input.dueId && input.dueAmount > 0
      ? [{ rent_due_id: input.dueId, amount_allocated: Math.min(amount, input.dueAmount) }]
      : []

  const { data: receptionId, error } = await supabase.rpc("record_collection", {
    p_tenant_id: input.tenantId,
    p_unit_id: input.unitId,
    p_amount: amount,
    p_method: input.method,
    p_received_at: input.receivedAt,
    p_note: null,
    p_allocations: allocations,
    p_request_id: validRequestId(input.requestId),
  })

  if (error || !receptionId) {
    return { ok: false, error: mapCollectionError(error?.message ?? "") }
  }

  const { error: confirmError } = await supabase.rpc("confirm_collection", {
    p_reception_id: receptionId,
  })
  if (confirmError) {
    return { ok: false, error: "Confirmation impossible. Reessayez." }
  }

  const { data: receiptId, error: receiptError } = await supabase.rpc("generate_receipt", {
    p_reception_id: receptionId,
  })
  if (receiptError || !receiptId) {
    return { ok: false, error: "Quittance non editee. Reessayez." }
  }

  const { data: receipt, error: readError } = await supabase
    .from("receipts")
    .select(
      "id, receipt_number, kind, total_amount, currency, issued_at, snapshot, tenant_token, sha256_fingerprint, tenant_ack",
    )
    .eq("id", receiptId)
    .maybeSingle()

  if (readError || !receipt) {
    return { ok: false, error: "Quittance editee, affichage indisponible." }
  }

  const snap = (receipt.snapshot ?? {}) as ReceiptSnapshot
  const tenantName = snap.tenant
    ? `${snap.tenant.first_name} ${snap.tenant.last_name}`.trim()
    : ""

  // Trois écritures d'argent ici (encaissement, confirmation, quittance) :
  // purge complète des surfaces argent via le helper (cache client 30 s).
  revalidateMoneySurfaces()

  return {
    ok: true,
    receipt: {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      kind: receipt.kind,
      totalAmount: receipt.total_amount,
      amountLabel: fcfa(receipt.total_amount, receipt.currency),
      currency: receipt.currency,
      issuedAt: receipt.issued_at,
      tenantName,
      unitLabel: snap.unit?.name ?? "",
      periodLabel: monthLabel(snap.allocations?.[0]?.period_start ?? null),
      verifyRef: `ranti.app/recu/${receipt.tenant_token}`,
      // Empreinte affichee uniquement si le serveur l'a calculee (sinon omise,
      // handoff sec.11 : jamais de placeholder presente comme fonctionnel).
      sha256: receipt.sha256_fingerprint ?? null,
      // Quittance fraiche : le locataire n'a pas encore confirme.
      tenantConfirmed: receipt.tenant_ack === "certified",
    },
  }
}
