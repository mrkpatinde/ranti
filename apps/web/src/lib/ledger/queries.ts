import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { LeaseBalance, LedgerCharge } from "./types"

// Colonnes explicites : la parité avec la vue SQL est figée par un test
// (queries.test.ts) — même doctrine que payments/queries.ts.
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

export const LEDGER_CHARGES_SELECT =
  "id, lease_id, type, amount, currency, occurred_at, due_date, status, validated_by, validated_at, disputed_at, contest_nature, contested_amount, tenant_comment, resolution, resolved_at, replaced_by, tenant_token, label"

// Charges variables d'un bail (ADR-023 §3 ligne 2), toutes vivantes ou
// retirées — l'historique reste lisible sur la fiche bail. Les loyers et
// règlements ne passent pas ici : ils ont leurs propres surfaces.
export async function getLeaseLedgerCharges(
  landlordId: string,
  leaseId: string,
): Promise<LedgerCharge[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("transactions")
    .select(LEDGER_CHARGES_SELECT)
    .eq("landlord_id", landlordId)
    .eq("lease_id", leaseId)
    .in("type", ["reparation", "frais"])
    .order("occurred_at", { ascending: false })

  if (error) failQuery("transactions", error)

  return (data ?? []) as LedgerCharge[]
}

// ── Charges relançables (relances programmées, 2026-07-18) ──────────────────

export type OpenCharge = {
  id: string
  lease_id: string
  type: "reparation" | "frais"
  label: string
  amount: number
}

// Charges VALIDÉES par le locataire, non remplacées : les seules qu'une
// relance peut viser (pending = pas encore certaine, disputed = litige que
// Ranti documente sans presser). Le filtre « le bail porte un impayé au grand
// livre » s'applique côté appelant (lease_balances déjà chargée).
export async function getLandlordOpenCharges(landlordId: string): Promise<OpenCharge[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("id, lease_id, type, label, amount")
    .eq("landlord_id", landlordId)
    .in("type", ["reparation", "frais"])
    .eq("direction", "debit")
    .eq("status", "validated")
    .is("replaced_by", null)
    .order("occurred_at", { ascending: false })

  if (error) failQuery("getLandlordOpenCharges", error)
  return (data ?? []) as OpenCharge[]
}
