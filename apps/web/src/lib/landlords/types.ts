import type { Civility } from "@/lib/auth/validation"

// Prise en main guidée (welcome-flow.md) : pending (accueil pas vu) → guided
// (checklist) | exploring (« Passer pour l'instant ») → done. Progression des
// étapes dérivée des données, jamais stockée (cf. lib/onboarding/progress.ts).
export type OnboardingStatus = "pending" | "guided" | "exploring" | "done"

export type Landlord = {
  id: string
  auth_user_id: string
  phone: string
  first_name: string
  last_name: string
  civility: Civility | null
  payment_alias: string | null
  payment_alias_type: "phone" | "address" | null
  onboarding_status: OnboardingStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
}
