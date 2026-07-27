import { redirect } from "next/navigation"
import { MONTHS_FR } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { getFirstRunSeed } from "@/lib/onboarding/first-run-seed"
import type { OnboardingStatus } from "@/lib/landlords"
import type { Step } from "./shared"
import type { LeaseSeed } from "./state"
import { FirstRunClient } from "./first-run-client"

// Route de prise en main cablee a la base (phase 3) : composant serveur qui
// exige le profil bailleur (auth Google, ADR-010), passe l'identite reelle au
// client et calcule les libelles de date cote serveur (aucune hydratation
// divergente). Un bailleur qui a deja termine l'onboarding est renvoye vers son
// vrai tableau de bord.

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

  // Bails deja en base : sans eux, un rechargement repartait d'un ecran vide et
  // le bailleur pouvait ressaisir un bail deja cree (doublon de logement et de
  // locataire sur son premier contact avec le produit).
  const seed = await getFirstRunSeed(landlord.id)

  const statusStep =
    STEP_BY_STATUS[landlord.onboarding_status as Exclude<OnboardingStatus, "done">] ?? "welcome"

  // Un bail principal existe deja : l'etape « setup » afficherait le formulaire
  // de creation vide, c'est-a-dire l'invitation exacte a creer le doublon. On
  // reprend a « lease ». Les etapes plus avancees (reminder, active) ne sont
  // jamais regressees, et « welcome » / « explore » restent des choix du
  // bailleur qu'on ne surcharge pas.
  const initialStep = seed.primary && statusStep === "setup" ? "lease" : statusStep

  const initialLeases: LeaseSeed = {
    primary: seed.primary
      ? {
          name: seed.primary.name,
          home: seed.primary.home,
          amount: seed.primary.amount,
          leaseId: seed.primary.leaseId,
          unitId: seed.primary.unitId,
          tenantId: seed.primary.tenantId,
          dueId: seed.primary.dueId,
          dueAmount: seed.primary.dueAmount,
        }
      : null,
    added: seed.added.map((l, i) => ({
      id: `seeded-${i + 1}`,
      name: l.name,
      home: l.home,
      amount: l.amount,
      status: l.status,
      leaseId: l.leaseId,
      unitId: l.unitId,
      tenantId: l.tenantId,
      dueId: l.dueId,
      dueAmount: l.dueAmount,
    })),
  }

  return (
    <FirstRunClient
      landlord={{
        firstName: landlord.first_name,
        fullName,
        initials: initials(landlord.first_name, landlord.last_name),
      }}
      monthLabel={monthLabel}
      todayIso={todayIso}
      initialStep={initialStep}
      initialReminders={{
        active: landlord.reminders_enabled,
        canal: landlord.reminder_channel ?? "whatsapp",
        moment: landlord.reminder_moment ?? "echeance",
      }}
      initialLeases={initialLeases}
    />
  )
}
