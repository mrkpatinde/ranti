// ADR-018 v2 — Accès données du ledger côté webhook : appel RPC mince.
// Les invariants vivent en base (CHECKs + RPC SECURITY DEFINER).
// L'interface existe pour rendre service.ts testable avec un mock.
// La validation propriétaire passe par src/lib/payments/actions.ts
// (convention maison : les server actions appellent supabase.rpc directement).

import type { SupabaseClient } from "@supabase/supabase-js"
import { paymentErrorCodeFromMessage } from "./errors"
import type { IngestResult, PaymentTransactionStatus } from "./types"
import { PaymentError } from "./types"

export interface IngestNotificationInput {
  provider: string
  reference: string
  leaseId: string
  amount: number
  payload: Record<string, unknown> | null
}

export interface PaymentsRepository {
  /** Idempotent : rejouer une référence connue renvoie la ligne existante. */
  ingestNotification(input: IngestNotificationInput): Promise<IngestResult>
}

// Client service_role obligatoire : la RPC d'ingestion n'est pas accordée
// aux rôles client (voir migration payment_transactions_ledger).
export function createPaymentsRepository(
  supabase: SupabaseClient,
): PaymentsRepository {
  return {
    async ingestNotification(input) {
      const { data, error } = await supabase.rpc("ingest_payment_notification", {
        p_provider: input.provider,
        p_reference: input.reference,
        p_lease_id: input.leaseId,
        p_amount: input.amount,
        p_payload: input.payload,
      })

      if (error) {
        throw new PaymentError(paymentErrorCodeFromMessage(error.message), error.message)
      }

      const row = Array.isArray(data) ? data[0] : data
      if (!row) throw new PaymentError("technical", "ingest: empty result")

      return {
        transactionId: String(row.transaction_id),
        status: row.status as PaymentTransactionStatus,
        created: Boolean(row.created),
      }
    },
  }
}
