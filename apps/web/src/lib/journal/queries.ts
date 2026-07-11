import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"
import type { JournalEvent } from "./types"

const JOURNAL_SELECT =
  "event_type, occurred_at, label, amount, currency, ref_table, ref_id, counterparty, unit_label, reference, allocated"

// Flux chronologique du propriétaire connecté. La vue journal_feed est en
// security_invoker : la RLS des tables sources s'applique automatiquement, donc
// pas de filtre landlord_id ici. Tri décroissant, le plus récent en tête.
export async function getJournalFeed(limit = 200): Promise<JournalEvent[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("journal_feed")
    .select(JOURNAL_SELECT)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) failQuery("journal_feed", error)

  return (data ?? []) as JournalEvent[]
}

// Nombre d'événements du mois courant (résumé discret de l'en-tête).
export function countThisMonth(events: JournalEvent[], now = new Date()): number {
  const y = now.getFullYear()
  const m = now.getMonth()
  return events.filter((e) => {
    const d = new Date(e.occurred_at)
    return d.getFullYear() === y && d.getMonth() === m
  }).length
}
