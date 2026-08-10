import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Receipt } from "./types"

// Liste explicite, sans `tenant_token` : la colonne est retirée de la portée
// de lecture du gestionnaire (migration 20260809120300). Un `select("*")`
// échouerait en « permission denied for column ». Le lien de partage passe
// désormais par la RPC receipt_share_token, qui journalise chaque accès.
const RECEIPT_COLUMNS = [
  "id", "landlord_id", "rent_reception_id", "receipt_number", "issued_at",
  "total_amount", "currency", "status", "pdf_storage_path", "cancelled_at",
  "cancellation_reason", "created_at", "updated_at", "deleted_at", "snapshot",
  "kind", "replaces_receipt_id", "tenant_ack", "tenant_read_at",
  "tenant_certified_at", "contested_at", "contest_nature", "contested_amount",
  "contested_period", "sha256_fingerprint",
].join(",")

export async function getLandlordReceipts(landlordId: string): Promise<Receipt[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("receipts")
    .select(RECEIPT_COLUMNS)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("issued_at", { ascending: false })

  if (error) failQuery("receipts", error)

  return (data ?? []) as unknown as Receipt[]
}

export async function getReceipt(landlordId: string, id: string): Promise<Receipt | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("receipts")
    .select(RECEIPT_COLUMNS)
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("receipts", error)

  return (data as unknown as Receipt | null) ?? null
}

// Jeton de partage d'une quittance. Passe par la RPC : la lecture directe de
// la colonne est révoquée, et chaque demande laisse une trace dans audit_logs.
export async function getReceiptShareToken(receiptId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("receipt_share_token", { p_receipt_id: receiptId })
  if (error) return null
  return (data as string | null) ?? null
}
