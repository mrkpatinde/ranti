import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"

// Une relance envoyée, avec le contexte de son échéance pour l'affichage.
// Deux sources fusionnées :
// - reminders : SMS automatiques du cron (templates j-5 … j+10)
// - reminder_events : relances manuelles traitées par l'opérateur Ranti
//   via ranti-ops (types j_5, j_1, late_j_1, late_j_3, canal whatsapp_manual)
export type ReminderWithContext = {
  id: string
  channel: "sms" | "whatsapp" | "whatsapp_manual"
  template: string
  sent_at: string
  status: "sent" | "delivered" | "failed"
  rent_due: {
    due_date: string
    period_start: string
    period_end: string
    amount_due: number
    status: string
    tenant: { first_name: string; last_name: string } | null
    unit: { name: string } | null
  } | null
}

const RENT_DUE_SELECT =
  "due_date, period_start, period_end, amount_due, status, tenant:tenants(first_name, last_name), unit:units(name)"

// Les types ranti-ops vers les fenêtres affichées côté propriétaire.
const OPS_TYPE_TO_TEMPLATE: Record<string, string> = {
  j_5: "j-5",
  j_1: "j-1",
  late_j_1: "j+1",
  late_j_3: "j+3",
}

export async function getLandlordReminders(
  landlordId: string
): Promise<ReminderWithContext[]> {
  const supabase = await createClient()

  const [auto, manual] = await Promise.all([
    supabase
      .from("reminders")
      .select(
        `id, channel, template, sent_at, status, rent_due:rent_dues(${RENT_DUE_SELECT})`
      )
      .eq("landlord_id", landlordId)
      .order("sent_at", { ascending: false })
      .limit(200),
    supabase
      .from("reminder_events")
      .select(
        `id, reminder_type, sent_at, status, rent_due:rent_dues(${RENT_DUE_SELECT})`
      )
      .eq("landlord_id", landlordId)
      .order("sent_at", { ascending: false })
      .limit(200),
  ])

  if (auto.error) failQuery("reminders", auto.error)
  if (manual.error) failQuery("reminder_events", manual.error)

  const autoRows = (auto.data ?? []) as unknown as ReminderWithContext[]

  const manualRows: ReminderWithContext[] = (
    (manual.data ?? []) as unknown as Array<
      Omit<ReminderWithContext, "channel" | "template"> & {
        reminder_type: string
      }
    >
  ).map(({ reminder_type, ...row }) => ({
    ...row,
    channel: "whatsapp_manual",
    template: OPS_TYPE_TO_TEMPLATE[reminder_type] ?? reminder_type,
  }))

  return [...autoRows, ...manualRows]
    .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))
    .slice(0, 200)
}
