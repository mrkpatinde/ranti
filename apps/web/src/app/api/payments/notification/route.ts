// ============================================================
// Webhook paiement PSP — ADR-017 (forme) / ADR-018 (rail Kkiapay).
// Route POST /api/payments/notification — appelée par Kkiapay.
//
// Ordre strict : secret configuré → signature HMAC sur corps BRUT →
// normalisation → processPayment (ingestion idempotente, service_role).
// Le webhook INGÈRE seulement : la validation est celle du propriétaire
// (ADR-017/ADR-018 v2). Réponses : 200 pour tout événement TRAITÉ
// (pending/rejected/duplicate, bail introuvable — retenter ne changera rien) ;
// 401 signature ; 400 forme ; 500 uniquement panne technique (le PSP retente).
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin"
import {
  KKIAPAY_SIGNATURE_HEADER,
  verifyKkiapaySignature,
} from "@/lib/kkiapay"
import {
  createPaymentsRepository,
  normalizeKkiapayPayload,
  processPayment,
} from "@/lib/payments"
import { PaymentError } from "@/lib/payments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Statuts PSP considérés comme un paiement réussi. Un événement signé mais
// non réussi (FAILED, PENDING côté PSP…) n'est PAS un paiement : il est
// ignoré sans écriture. "UNKNOWN" (statut absent du payload) reste accepté
// tant que le vocabulaire exact n'est pas verrouillé avec la doc du PSP.
const SUCCESS_STATUSES = new Set(["SUCCESS", "SUCCESSFUL", "APPROVED", "UNKNOWN"])

export async function POST(request: Request) {
  const secret = process.env.KKIAPAY_WEBHOOK_SECRET
  if (!secret) {
    return Response.json(
      { error: "KKIAPAY_WEBHOOK_SECRET not configured" },
      { status: 500 },
    )
  }

  // Corps BRUT obligatoire : la signature porte sur les octets reçus,
  // pas sur un JSON re-sérialisé.
  const rawBody = await request.text()
  const signature = request.headers.get(KKIAPAY_SIGNATURE_HEADER)

  if (!verifyKkiapaySignature(rawBody, signature, secret)) {
    return Response.json({ error: "signature_invalid" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }

  const event = normalizeKkiapayPayload(json)
  if (!event) {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }

  // Défense en profondeur : ne jamais ingérer un événement dont le PSP
  // annonce lui-même l'échec — sinon une transaction fantôme 'pending'
  // pourrait être validée par le propriétaire sans argent réellement reçu.
  if (!SUCCESS_STATUSES.has(event.providerStatus.toUpperCase())) {
    console.log(
      `[WEBHOOK] kkiapay ref=${event.reference} ignored provider_status=${event.providerStatus}`,
    )
    return Response.json({ ok: true, outcome: "ignored", reason: "provider_status_not_success" })
  }

  // Client service_role : le webhook n'a pas de session utilisateur et les
  // RPC du ledger ne sont accordées qu'à service_role.
  const supabase = createAdminClient()
  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SECRET_KEY not configured" },
      { status: 500 },
    )
  }

  try {
    const result = await processPayment(createPaymentsRepository(supabase), {
      leaseId: event.leaseId,
      amountReceived: event.amount,
      provider: "kkiapay",
      reference: event.reference,
      payload: event.payload,
    })

    console.log(
      `[WEBHOOK] kkiapay ref=${event.reference} outcome=${result.outcome} tx=${result.transactionId}`,
    )
    return Response.json({ ok: true, ...result })
  } catch (err) {
    // Bail introuvable : événement traité (le retry PSP ne changera rien),
    // loggé pour investigation ops. Le reste = panne technique → 500 → retry.
    if (err instanceof PaymentError && err.code === "lease_not_found") {
      console.error(
        `[WEBHOOK] kkiapay ref=${event.reference} lease_not_found lease=${event.leaseId}`,
      )
      return Response.json({ ok: false, error: "lease_not_found" })
    }

    console.error(`[WEBHOOK] kkiapay ref=${event.reference} technical`, err)
    return Response.json({ error: "internal" }, { status: 500 })
  }
}
