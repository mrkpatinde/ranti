"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import type { ReminderChannel, ReminderMoment } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"

// Réglages de relance (FirstRun : modale Relance + vues Relances / Paramètres).
// Colonnes non-identité sur landlords → update direct sous RLS
// (landlords_update_own), aucun RPC requis (même patron que setOnboardingStatus,
// ADR-002). Persistance seule ; le respect côté file de relance
// (ops_reminder_queue, ADR-023 gelé) est un suivi séparé.
//
// Appelée par le parcours /first-run (phase 3) et ses vues Relances /
// Paramètres. Jamais bloquant : une erreur DB est journalisée, pas propagée.

const CHANNELS: readonly ReminderChannel[] = ["whatsapp", "sms"]
const MOMENTS: readonly ReminderMoment[] = ["avant", "echeance", "retard"]

export type ReminderSettingsInput = {
  enabled: boolean
  channel: ReminderChannel
  moment: ReminderMoment
}

export async function setReminderSettings(input: ReminderSettingsInput): Promise<void> {
  if (!CHANNELS.includes(input.channel) || !MOMENTS.includes(input.moment)) return

  const landlord = await requireLandlordProfile()
  const supabase = await createClient()

  const { error } = await supabase
    .from("landlords")
    .update({
      reminders_enabled: input.enabled,
      reminder_channel: input.channel,
      reminder_moment: input.moment,
    })
    .eq("id", landlord.id)

  if (error) {
    console.error("setReminderSettings: update failed", error.code, error.message)
  }

  revalidatePath("/reminders")
  revalidatePath("/settings/profile")
}

// ── Programmer / annuler une relance ponctuelle (2026-07-18) ────────────────
// Le propriétaire choisit l'échéance, la date et le canal ; ranti-ops envoie à
// la date dite (ops_scheduled_reminders, doctrine ADR-022 : l'envoi vit chez
// l'opérateur). Invariants côté RPC : appartenance de l'échéance, date >=
// aujourd'hui, une seule programmation pending par échéance et par date.

const SCHEDULE_ERRORS: Record<string, string> = {
  date_past: "Choisissez une date à partir d'aujourd'hui.",
  due_settled: "Cette échéance est déjà soldée ou annulée.",
  due_not_found: "Échéance introuvable.",
  already_scheduled: "Une relance est déjà programmée pour cette échéance à cette date.",
  channel_invalid: "Canal invalide.",
  not_pending: "Cette relance a déjà été envoyée ou annulée.",
}

function scheduleError(message: string, fallback = "Programmation impossible. Réessayez."): string {
  for (const [code, label] of Object.entries(SCHEDULE_ERRORS)) {
    if (message.includes(code)) return label
  }
  return fallback
}

export async function scheduleReminder(formData: FormData): Promise<void> {
  await requireLandlordProfile()
  const supabase = await createClient()

  // target = "due:<id>" (échéance de loyer).
  const target = String(formData.get("target") ?? "")
  const scheduledFor = String(formData.get("scheduled_for") ?? "")
  const channel = String(formData.get("channel") ?? "")

  const back = (msg: string): never => {
    redirect(`/reminders?error=${encodeURIComponent(msg)}`)
  }
  const [targetKind, targetId] = target.split(":")
  if (!targetId || targetKind !== "due") {
    back("Choisissez la dette à relancer.")
  }
  if (!scheduledFor) back("Choisissez la date d'envoi.")

  const { error } = await supabase.rpc("schedule_reminder", {
    p_rent_due_id: targetId,
    p_scheduled_for: scheduledFor,
    p_channel: channel,
  })

  if (error) back(scheduleError(error.message))

  revalidatePath("/reminders")
  redirect("/reminders?notice=reminder_scheduled")
}

// Retourne l'erreur au lieu de rediriger : consommée par le composant client
// optimiste (ScheduledReminders), qui masque la ligne immédiatement et
// restaure + affiche l'erreur si la RPC échoue. La revalidation apporte
// l'état réel en cas de succès.
export async function cancelScheduledReminder(
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireLandlordProfile()
  const supabase = await createClient()

  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Relance introuvable." }

  const { error } = await supabase.rpc("cancel_scheduled_reminder", { p_id: id })
  if (error) {
    // Revalider AUSSI sur échec : « not_pending » signifie que la ligne a déjà
    // été envoyée ou annulée ailleurs (autre onglet, cron ops) ; sans purge,
    // le retour d'état optimiste restaurerait une ligne fantôme jusqu'à la
    // prochaine navigation.
    revalidatePath("/reminders")
    return { error: scheduleError(error.message, "Annulation impossible. Réessayez.") }
  }

  revalidatePath("/reminders")
  return { error: null }
}
