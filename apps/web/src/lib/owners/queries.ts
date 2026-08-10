import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { Property } from "@/lib/properties"
import type { Owner, OwnerMonthSummary, OwnerWithMonth } from "./types"

export async function getLandlordOwners(landlordId: string): Promise<Owner[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("owners")
    .select("*")
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .order("display_name", { ascending: true })

  if (error) failQuery("owners", error)

  return (data ?? []) as Owner[]
}

export async function getOwner(landlordId: string, id: string): Promise<Owner | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("owners")
    .select("*")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) failQuery("owners", error)

  return (data as Owner | null) ?? null
}

// Clôture du mois en cours, par mandant (vue owner_month_summary).
export async function getOwnerMonthSummaries(
  landlordId: string,
): Promise<OwnerMonthSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("owner_month_summary")
    .select("*")
    .eq("landlord_id", landlordId)

  if (error) failQuery("owner_month_summary", error)

  return (data ?? []) as OwnerMonthSummary[]
}

/**
 * Liste complète des mandants avec leurs chiffres du mois. La vue ne renvoie
 * que les mandants qui ont au moins un lot : les autres sont complétés à zéro
 * pour rester visibles dans la liste.
 */
export async function getOwnersWithMonth(landlordId: string): Promise<OwnerWithMonth[]> {
  const [owners, summaries] = await Promise.all([
    getLandlordOwners(landlordId),
    getOwnerMonthSummaries(landlordId),
  ])

  const byOwner = new Map(summaries.map((summary) => [summary.owner_id, summary]))

  return owners.map((owner) => withMonth(owner, byOwner.get(owner.id)))
}

// Les colonnes de la vue sont des bigint : on force le nombre pour que
// formatFcfa reçoive toujours un entier, jamais une chaîne.
function withMonth(owner: Owner, summary: OwnerMonthSummary | undefined): OwnerWithMonth {
  return {
    ...owner,
    units: Number(summary?.units ?? 0),
    collected: Number(summary?.collected ?? 0),
    fee: Number(summary?.fee ?? 0),
    net_due_to_owner: Number(summary?.net_due_to_owner ?? 0),
  }
}

export async function getOwnerWithMonth(
  landlordId: string,
  id: string,
): Promise<OwnerWithMonth | null> {
  const owner = await getOwner(landlordId, id)
  if (!owner) return null

  const summaries = await getOwnerMonthSummaries(landlordId)

  return withMonth(
    owner,
    summaries.find((line) => line.owner_id === id),
  )
}

// Biens gérés pour ce mandant (owner_id du bien).
export async function getOwnerProperties(
  landlordId: string,
  ownerId: string,
): Promise<Property[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("landlord_id", landlordId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) failQuery("properties", error)

  return (data ?? []) as Property[]
}
