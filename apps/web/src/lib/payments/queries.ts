// ADR-018 — Lectures du ledger côté propriétaire (client invoker : RLS
// restreint à ses lignes). Erreur DB jamais avalée (failQuery).

import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { PaymentTransaction } from "./types"

export async function listPaymentTransactions(): Promise<PaymentTransaction[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payment_transactions")
    .select(
      "id, landlord_id, lease_id, provider, provider_reference, amount_received, service_fee_bp, service_fee, net_amount, currency, status, rejection_reason, rent_reception_id, created_at, verified_at, paid_out_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) failQuery("payment_transactions", error)
  return (data ?? []) as PaymentTransaction[]
}
