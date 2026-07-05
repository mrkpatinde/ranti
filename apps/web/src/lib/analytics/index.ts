import "server-only"

import { createClient } from "@/lib/supabase/server"

// Métrique sprint : « le proprio vient-il de lui-même ? »
// Une connexion est « hors relance » si aucune relance n'a été envoyée à ce
// bailleur dans les 60 minutes précédentes. Best-effort : ne bloque jamais
// le flux d'authentification.
export async function logLoginEvent(): Promise<void> {
  try {
    const supabase = await createClient()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentReminders } = await supabase
      .from("reminder_events")
      .select("id")
      .gte("sent_at", oneHourAgo)
      .limit(1)

    const event =
      recentReminders && recentReminders.length > 0
        ? "login_after_reminder"
        : "login_outside_reminder"

    await supabase.rpc("log_product_event", { p_event: event })
  } catch {
    // Jamais bloquant : la métrique est secondaire, la connexion est prioritaire.
  }
}
