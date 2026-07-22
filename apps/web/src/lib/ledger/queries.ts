import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { LeaseBalance } from "./types"

// Colonnes explicites : la parité avec la vue SQL est figée par un test
// (queries.test.ts) — même doctrine que payments/queries.ts. Les colonnes de
// débits (pending_debits, disputed_debits) sont dormantes depuis le retrait des
// charges (ADR-026) mais restent dans la vue, on les lit encore (valeur 0).
export const LEASE_BALANCES_SELECT =
  "lease_id, landlord_id, certain_balance, pending_debits, pending_credits, disputed_debits, disputed_credits, overdue_amount"

// Soldes du grand livre par bail (vue lease_balances, ADR-023 §6). La vue est
// en security_invoker (la RLS de transactions s'applique) ; le filtre
// landlord_id reste explicite par défense en profondeur, comme
// rent_due_balances. Pas de deleted_at : la vue agrège par bail.
export async function getLandlordLeaseBalances(landlordId: string): Promise<LeaseBalance[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("lease_balances")
    .select(LEASE_BALANCES_SELECT)
    .eq("landlord_id", landlordId)
    .order("overdue_amount", { ascending: false })

  if (error) failQuery("lease_balances", error)

  return (data ?? []) as LeaseBalance[]
}

// Solde d'UN bail (fiche bail) — mêmes colonnes, même vue.
export async function getLeaseBalance(
  landlordId: string,
  leaseId: string,
): Promise<LeaseBalance | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("lease_balances")
    .select(LEASE_BALANCES_SELECT)
    .eq("landlord_id", landlordId)
    .eq("lease_id", leaseId)
    .maybeSingle()

  if (error) failQuery("lease_balances", error)

  return (data as LeaseBalance | null) ?? null
}
