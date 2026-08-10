import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import { monthStartIso } from "./month"
import { statementToClosingRow } from "./totals"
import type { ClosingRow, OwnerStatement, OwnerSummaryRow } from "./types"

// Lectures de la clôture. Tout passe par la RLS de l'agence connectée : la vue
// `owner_month_summary` et les RPC `owner_statement*` sont security_invoker.

/** SQLSTATE levé par les RPC quand le mandant n'existe pas (ou n'est pas à
 *  cette agence). Ce n'est pas une panne : la page répond 404. */
const NOT_FOUND = "P0002"

/** Le portefeuille de mandants (mois en cours) — sert aussi de liste de
 *  référence pour clôturer un mois passé. */
export async function getOwnerSummaries(landlordId: string): Promise<OwnerSummaryRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("owner_month_summary")
    .select("owner_id, landlord_id, display_name, fee_rate_bp, units, collected, fee, net_due_to_owner")
    .eq("landlord_id", landlordId)
    .order("display_name", { ascending: true })

  if (error) failQuery("owner_month_summary", error)
  return (data ?? []) as OwnerSummaryRow[]
}

/** Le relevé complet d'un mandant sur un mois. null = mandant inconnu. */
export async function getOwnerStatement(
  ownerId: string,
  month: string,
): Promise<OwnerStatement | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("owner_statement", {
    p_owner_id: ownerId,
    p_month: monthStartIso(month),
  })

  if (error) {
    if (error.code === NOT_FOUND) return null
    failQuery("owner_statement", error)
  }
  if (!data) return null

  return data as OwnerStatement
}

// Les relevés partent en parallèle mais par vagues : une agence peut avoir
// quarante mandants, et quarante requêtes simultanées sur une connexion de
// terrain se battent entre elles plus qu'elles n'accélèrent la page.
const STATEMENT_CONCURRENCY = 8

async function mapInWaves<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

/**
 * Le tableau de clôture d'un mois : une ligne par mandant.
 *
 * Les chiffres viennent du relevé de chaque mandant, y compris pour le mois en
 * cours, alors que `owner_month_summary` les porte déjà. Deux raisons : la vue
 * n'expose pas l'attendu, et elle applique le taux d'honoraires au total du
 * mandant là où le relevé l'applique ligne par ligne — les deux peuvent
 * diverger de quelques francs. Le tableau de l'agence et le document remis au
 * mandant doivent afficher le même chiffre. La vue reste la liste de référence
 * des mandants.
 */
export async function getClosingRows(landlordId: string, month: string): Promise<ClosingRow[]> {
  const owners = await getOwnerSummaries(landlordId)
  if (owners.length === 0) return []

  const statements = await mapInWaves(owners, STATEMENT_CONCURRENCY, (owner) =>
    getOwnerStatement(owner.owner_id, month),
  )

  return statements
    .filter((statement): statement is OwnerStatement => statement !== null)
    .map(statementToClosingRow)
}
