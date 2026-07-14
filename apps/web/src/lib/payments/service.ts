// ADR-018 v2 — Cycle de vie d'une transaction : orchestration pure, zéro IA.
//
// Le webhook INGÈRE seulement (idempotent). La validation est celle du
// PROPRIÉTAIRE (ADR-017) : verify_payment_transaction est appelée depuis le
// server action src/lib/payments/actions.ts avec la session du propriétaire.
// Toute la logique d'argent est en Postgres ; ce service ne décide rien
// qu'il ne délègue à une RPC.

import type { PaymentsRepository } from "./repository"
import type { ProcessPaymentResult } from "./types"
import { PaymentError } from "./types"

export interface ProcessPaymentInput {
  leaseId: string
  amountReceived: number
  provider: string
  reference: string
  payload: Record<string, unknown> | null
}

export async function processPayment(
  repo: PaymentsRepository,
  input: ProcessPaymentInput,
): Promise<ProcessPaymentResult> {
  const ingest = await repo.ingestNotification({
    provider: input.provider,
    reference: input.reference,
    leaseId: input.leaseId,
    amount: input.amountReceived,
    payload: input.payload,
  })

  // Replay webhook : déjà ingérée, on ne retouche à rien (idempotence).
  if (!ingest.created) {
    return {
      outcome: "duplicate",
      transactionId: ingest.transactionId,
      status: ingest.status,
    }
  }

  // Montant inattendu / bail inactif : la RPC a enregistré la ligne 'rejected'
  // (jamais droppée — l'argent a bougé chez le PSP, on le trace).
  if (ingest.status === "rejected") {
    return { outcome: "rejected", transactionId: ingest.transactionId }
  }

  if (ingest.status !== "pending") {
    // Un ingest fraîchement créé ne peut être que pending ou rejected.
    throw new PaymentError("technical", `ingest: statut inattendu ${ingest.status}`)
  }

  return { outcome: "pending", transactionId: ingest.transactionId }
}
