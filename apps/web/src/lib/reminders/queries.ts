import { createClient } from "@/lib/supabase/server"
import { failQuery } from "@/lib/supabase/query-error"

// Une relance envoyée, avec le contexte de son échéance pour l'affichage.
export type ReminderWithContext = {
  id: string
  channel: "sms" | "whatsapp"
  template: string
  sent_at: string
  recipient: string
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

export async function getLandlordReminders(
  landlordId: string
): Promise<ReminderWithContext[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("reminders")
    .select(
      "id, channel, template, sent_at, recipient, status, rent_due:rent_dues(due_date, period_start, period_end, amount_due, status, tenant:tenants(first_name, last_name), unit:units(name))"
    )
    .eq("landlord_id", landlordId)
    .order("sent_at", { ascending: false })
    .limit(200)

  if (error) failQuery("reminders", error)

  return (data ?? []) as unknown as ReminderWithContext[]
}
