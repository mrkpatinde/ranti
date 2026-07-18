import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import type { OnboardingStatus } from "@/lib/landlords"
import type { Step } from "./shared"
import { FirstRunClient } from "./first-run-client"

// Route de prise en main cablee a la base (phase 3) : composant serveur qui
// exige le profil bailleur (auth Google, ADR-010), passe l'identite reelle au
// client et calcule les libelles de date cote serveur (aucune hydratation
// divergente). Un bailleur qui a deja termine l'onboarding est renvoye vers son
// vrai tableau de bord.

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

// L'etape initiale reflete le statut d'onboarding deja persiste (welcome-flow).
const STEP_BY_STATUS: Record<Exclude<OnboardingStatus, "done">, Step> = {
  pending: "welcome",
  guided: "setup",
  exploring: "explore",
}

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0)
  const b = last.trim().charAt(0)
  return (a + b).toUpperCase() || "?"
}

export default async function FirstRunPage() {
  const landlord = await requireLandlordProfile()

  if (landlord.onboarding_status === "done") {
    redirect("/dashboard")
  }

  const now = new Date()
  const monthLabel = `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const fullName = `${landlord.first_name} ${landlord.last_name}`.trim()

  return (
    <FirstRunClient
      landlord={{
        firstName: landlord.first_name,
        fullName,
        initials: initials(landlord.first_name, landlord.last_name),
      }}
      monthLabel={monthLabel}
      todayIso={todayIso}
      initialStep={STEP_BY_STATUS[landlord.onboarding_status as Exclude<OnboardingStatus, "done">] ?? "welcome"}
    />
  )
}
