import { getLandlordLeases } from "@/lib/leases"
import { getLandlordCollections } from "@/lib/collections"
import { getLandlordReceipts } from "@/lib/receipts"
import { getLandlordReminders } from "@/lib/reminders/queries"

// Étapes « Premiers pas » de la prise en main guidée (FirstRun). Le libellé et
// la description reprennent le prototype de handoff. Chaque étape est marquée
// « faite » si la donnée réelle existe — la progression n'est jamais stockée,
// elle est dérivée à chaque rendu.
export type OnboardingStep = {
  key: "lease" | "payment" | "receipt" | "reminder"
  label: string
  desc: string
  href: string
  done: boolean
}

export type OnboardingProgress = {
  steps: OnboardingStep[]
  total: number
  doneCount: number
  allDone: boolean
}

const STEP_META: Omit<OnboardingStep, "done">[] = [
  {
    key: "lease",
    label: "Créer votre premier bail",
    desc: "Le logement, l'occupant, le loyer mensuel.",
    href: "/leases/new",
  },
  {
    key: "payment",
    label: "Valider un paiement reçu",
    desc: "Vous encaissez, Ranti enregistre le règlement.",
    href: "/collections",
  },
  {
    key: "receipt",
    label: "Recevoir la première quittance",
    desc: "Numérotée, votre locataire la confirme en ligne.",
    href: "/receipts",
  },
  {
    key: "reminder",
    label: "Programmer une relance",
    desc: "WhatsApp, le jour de l'échéance.",
    href: "/reminders",
  },
]

export async function getOnboardingProgress(
  landlordId: string,
): Promise<OnboardingProgress> {
  const [leases, collections, receipts, reminders] = await Promise.all([
    getLandlordLeases(landlordId),
    getLandlordCollections(landlordId),
    getLandlordReceipts(landlordId),
    getLandlordReminders(landlordId),
  ])

  const done: Record<OnboardingStep["key"], boolean> = {
    lease: leases.length > 0,
    payment: collections.length > 0,
    receipt: receipts.length > 0,
    reminder: reminders.length > 0,
  }

  const steps: OnboardingStep[] = STEP_META.map((m) => ({
    ...m,
    done: done[m.key],
  }))
  const doneCount = steps.filter((s) => s.done).length

  return { steps, total: steps.length, doneCount, allDone: doneCount === steps.length }
}
