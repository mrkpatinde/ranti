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
    id: string
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
  "id, due_date, period_start, period_end, amount_due, status, tenant:tenants(first_name, last_name), unit:units(name)"

// Les types ranti-ops vers les fenêtres affichées côté propriétaire.
const OPS_TYPE_TO_TEMPLATE: Record<string, string> = {
  j_5: "j-5",
  j_1: "j-1",
  late_j_1: "j+1",
  late_j_3: "j+3",
}

// Fusionne les deux sources (SMS auto + WhatsApp ops) en un fil trié, récent
// d'abord. Le canal manuel est normalisé vers whatsapp_manual + fenêtre lisible.
function mergeReminderRows(
  autoData: unknown,
  manualData: unknown
): ReminderWithContext[] {
  const autoRows = (autoData ?? []) as unknown as ReminderWithContext[]

  const manualRows: ReminderWithContext[] = (
    (manualData ?? []) as unknown as Array<
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

  return mergeReminderRows(auto.data, manual.data)
}

// Fil des relances d'un bail : filtré sur les échéances du bail (rent_due_id).
// Alimente la fiche bail — relie « retard » (échéances) et « relances » au même
// endroit de gestion. Renvoie [] sans requête si le bail n'a pas d'échéance.
export async function getLeaseReminders(
  landlordId: string,
  dueIds: string[]
): Promise<ReminderWithContext[]> {
  if (dueIds.length === 0) return []

  const supabase = await createClient()

  const [auto, manual] = await Promise.all([
    supabase
      .from("reminders")
      .select(
        `id, channel, template, sent_at, status, rent_due:rent_dues(${RENT_DUE_SELECT})`
      )
      .eq("landlord_id", landlordId)
      .in("rent_due_id", dueIds)
      .order("sent_at", { ascending: false })
      .limit(200),
    supabase
      .from("reminder_events")
      .select(
        `id, reminder_type, sent_at, status, rent_due:rent_dues(${RENT_DUE_SELECT})`
      )
      .eq("landlord_id", landlordId)
      .in("rent_due_id", dueIds)
      .order("sent_at", { ascending: false })
      .limit(200),
  ])

  if (auto.error) failQuery("reminders", auto.error)
  if (manual.error) failQuery("reminder_events", manual.error)

  return mergeReminderRows(auto.data, manual.data)
}

// ── Relances programmées par le propriétaire (2026-07-18) ───────────────────

export type ScheduledReminder = {
  id: string
  rent_due_id: string
  scheduled_for: string
  channel: "whatsapp" | "sms"
  status: "pending" | "sent" | "cancelled"
  created_at: string
}

// Relances programmées encore à envoyer, plus anciennes d'abord (RLS :
// le propriétaire ne voit que les siennes).
export async function getScheduledReminders(landlordId: string): Promise<ScheduledReminder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scheduled_reminders")
    .select("id, rent_due_id, scheduled_for, channel, status, created_at")
    .eq("landlord_id", landlordId)
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })

  if (error) failQuery("getScheduledReminders", error)
  return (data ?? []) as ScheduledReminder[]
}
