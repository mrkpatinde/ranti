"use server"

import { revalidatePath } from "next/cache"
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
