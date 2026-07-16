// ============================================================
// Webhook paiement PSP — ADR-017 (forme) / ADR-019 (rail FeexPay UNIQUE).
// Route POST /api/payments/notification — appelée par FeexPay.
//
// ADR-019 : FeexPay est le seul rail d'encaissement (supersède la coexistence
// multi-rail d'ADR-018 ; Kkiapay disqualifié dès ADR-018 v3). Enregistrer
// FEEXPAY_CALLBACK_URL = cette route côté marchand FeexPay.
//
// Ordre strict : secret configuré → signature HMAC sur corps BRUT →
// normalisation → processPayment (ingestion idempotente, service_role).
// Le webhook INGÈRE seulement : la validation est celle du propriétaire
// (ADR-017/ADR-018 v2). Réponses : 200 pour tout événement TRAITÉ
// (pending/rejected/duplicate, bail introuvable — retenter ne changera rien) ;
// 401 signature ; 400 forme ; 500 uniquement panne technique (le PSP retente).
//
// ⚠️ Activation production gatée BCEAO (ADR-019) : FEEXPAY_ENV reste `sandbox`
// tant que le gate n'est pas levé.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin"
import {
  FEEXPAY_SIGNATURE_HEADER,
  normalizeFeexpayPayload,
  verifyFeexpaySignature,
} from "@/lib/feexpay"
import {
  createPaymentsRepository,
  processPayment,
} from "@/lib/payments"
import { PaymentError } from "@/lib/payments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Politique statut (décision 2026-07-14, vocabulaire PSP non verrouillé) :
// seul un échec EXPLICITE est ignoré ; tout le reste — succès, statut
// inconnu, statut absent — est ingéré en `pending`. La validation
// propriétaire (ADR-017) reste la porte réelle, et le ledger ne droppe
// jamais un mouvement signé (ADR-018). À resserrer après le sandbox FeexPay.
const FAILURE_STATUSES = new Set([
  "FAILED",
  "FAILURE",
  "DECLINED",
  "CANCELLED",
  "CANCELED",
  "REFUSED",
  "EXPIRED",
])

export async function POST(request: Request) {
  const secret = process.env.FEEXPAY_WEBHOOK_SECRET
  if (!secret) {
    // Détail en log serveur seulement : ne pas révéler l'état de la
    // configuration à un appelant non authentifié (la vérification de
    // signature n'a pas encore eu lieu).
    console.error("[WEBHOOK] feexpay misconfigured: FEEXPAY_WEBHOOK_SECRET missing")
    return Response.json({ error: "internal" }, { status: 500 })
  }

  // Corps BRUT obligatoire : la signature porte sur les octets reçus,
  // pas sur un JSON re-sérialisé.
  const rawBody = await request.text()
  const signature = request.headers.get(FEEXPAY_SIGNATURE_HEADER)

  if (!verifyFeexpaySignature(rawBody, signature, secret)) {
    return Response.json({ error: "signature_invalid" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }

  const event = normalizeFeexpayPayload(json)
  if (!event) {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }

  // Seul un échec explicite du PSP est écarté : pas d'argent bougé, rien à
  // tracer. Tout autre statut (succès, inconnu, absent) entre en `pending`
  // et sera arbitré par le propriétaire — un vrai paiement au vocabulaire
  // imprévu ne doit jamais être perdu derrière un 200 non rejoué.
  if (FAILURE_STATUSES.has(event.providerStatus.toUpperCase())) {
    console.log(
      `[WEBHOOK] feexpay ref=${event.reference} ignored provider_status=${event.providerStatus}`,
    )
    return Response.json({ ok: true, outcome: "ignored", reason: "provider_status_failure" })
  }

  // Client service_role : le webhook n'a pas de session utilisateur et les
  // RPC du ledger ne sont accordées qu'à service_role.
  const supabase = createAdminClient()
  if (!supabase) {
    console.error("[WEBHOOK] feexpay misconfigured: SUPABASE_SECRET_KEY missing")
    return Response.json({ error: "internal" }, { status: 500 })
  }

  try {
    const result = await processPayment(createPaymentsRepository(supabase), {
      leaseId: event.leaseId,
      amountReceived: event.amount,
      provider: "feexpay",
      reference: event.reference,
      payload: event.payload,
    })

    console.log(
      `[WEBHOOK] feexpay ref=${event.reference} outcome=${result.outcome} tx=${result.transactionId}`,
    )
    // Contrat de réponse explicite : ne jamais épandre le type interne
    // (ProcessPaymentResult) dans le corps renvoyé au PSP.
    return Response.json({ ok: true, outcome: result.outcome })
  } catch (err) {
    // Bail introuvable : événement traité (le retry PSP ne changera rien),
    // loggé pour investigation ops. Le reste = panne technique → 500 → retry.
    if (err instanceof PaymentError && err.code === "lease_not_found") {
      console.error(
        `[WEBHOOK] feexpay ref=${event.reference} lease_not_found lease=${event.leaseId}`,
      )
      return Response.json({ ok: false, error: "lease_not_found" })
    }

    console.error(`[WEBHOOK] feexpay ref=${event.reference} technical`, err)
    return Response.json({ error: "internal" }, { status: 500 })
  }
}
