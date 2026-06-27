import { createClient } from "@/lib/supabase/server"
import type { Collection } from "./types"

// A query failure is never silently turned into "no data". Callers must be able
// to tell apart three situations: legitimate empty result, technical failure,
// and an RLS denial. Postgres reports RLS / permission denials with SQLSTATE
// 42501 ("insufficient_privilege"); everything else is a technical error.
export type CollectionsQueryErrorKind = "rls" | "technical"

export class CollectionsQueryError extends Error {
  readonly kind: CollectionsQueryErrorKind
  readonly code: string | undefined

  constructor(kind: CollectionsQueryErrorKind, code: string | undefined, message: string) {
    super(message)
    this.name = "CollectionsQueryError"
    this.kind = kind
    this.code = code
  }
}

function toQueryError(code: string | undefined, message: string): CollectionsQueryError {
  const kind: CollectionsQueryErrorKind = code === "42501" ? "rls" : "technical"
  return new CollectionsQueryError(kind, code, message)
}

export async function getLandlordCollections(landlordId: string): Promise<Collection[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_receptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("received_at", { ascending: false })

  if (error) {
    throw toQueryError(error.code, error.message)
  }

  // No error + empty array genuinely means "aucun encaissement".
  return (data ?? []) as Collection[]
}

export async function getCollection(landlordId: string, id: string): Promise<Collection | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rent_receptions")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw toQueryError(error.code, error.message)
  }

  return (data as Collection | null) ?? null
}
