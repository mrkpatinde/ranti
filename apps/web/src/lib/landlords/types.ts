import type { Civility } from "@/lib/auth/validation"

// Prise en main guidée (welcome-flow.md) : pending (accueil pas vu) → guided
// (checklist) | exploring (« Passer pour l'instant ») → done. Progression des
// étapes dérivée des données, jamais stockée (cf. lib/onboarding/progress.ts).
export type OnboardingStatus = "pending" | "guided" | "exploring" | "done"

// Réglages de relance (FirstRun) persistés par bailleur. null = non configuré,
// l'UI retombe sur whatsapp / echeance (cf. migration reminder_settings).
export type ReminderChannel = "whatsapp" | "sms"
export type ReminderMoment = "avant" | "echeance" | "retard"

export type Landlord = {
  id: string
  auth_user_id: string
  phone: string
  first_name: string
  last_name: string
  civility: Civility | null
  // Adresse postale du bailleur (mutable, contact). Figure sur la quittance
  // pour identifier complètement le bailleur (Loi 2022-30, art. 67).
  address: string | null
  city: string | null
  payment_alias: string | null
  payment_alias_type: "phone" | "address" | null
  onboarding_status: OnboardingStatus
  reminders_enabled: boolean
  reminder_channel: ReminderChannel | null
  reminder_moment: ReminderMoment | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
