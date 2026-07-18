import type { OnboardingStatus } from "@/lib/landlords"
import {
  getOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStep,
} from "./progress"

// Rail de la prise en main guidée (FirstRun — dialog stepper). Modèle SERVEUR
// dérivé du statut d'onboarding + de la progression réelle. Aucun état stocké :
// l'étape courante, la position et la prochaine cible se recalculent à chaque
// rendu à partir de getOnboardingProgress. L'étape active = première non faite
// (une étape faite le reste même si une antérieure ne l'est pas, cf. progress.ts
// et PremiersPas).

// État d'une étape sur le rail (pastille pleine / active / verrouillée).
export type GuidedStepState = "done" | "active" | "locked"

export type GuidedRailStep = OnboardingStep & { state: GuidedStepState }

// Position lisible « Étape {index} sur {total} » (index 1-based).
export type GuidedPosition = { index: number; total: number }

// Prochaine cible : le libellé + deep-link vers lequel pousse le rail.
export type GuidedTarget = { key: OnboardingStep["key"]; label: string; href: string }

export type GuidedRail = {
  status: OnboardingStatus
  // Le guidage est-il réellement en cours : statut « guided » ET au moins une
  // étape restante. Seule condition d'affichage du rail.
  active: boolean
  steps: GuidedRailStep[]
  // Étape courante = première non faite ; null quand tout est fait.
  current: GuidedRailStep | null
  // Position de l'étape courante ; null quand tout est fait.
  position: GuidedPosition | null
  // Prochaine cible (CTA du rail) ; null quand tout est fait.
  next: GuidedTarget | null
  // Vrai quand l'étape courante est la dernière (« Dernière étape »).
  isLastStep: boolean
  doneCount: number
  total: number
  allDone: boolean
}

// Dérivation pure (statut + progression → rail) : isolée du chargement pour
// rester testable sans toucher la base.
export function buildGuidedRail(
  status: OnboardingStatus,
  progress: OnboardingProgress,
): GuidedRail {
  const { steps, total, doneCount, allDone } = progress
  const activeIndex = steps.findIndex((s) => !s.done)

  const railSteps: GuidedRailStep[] = steps.map((step, i) => ({
    ...step,
    state: step.done ? "done" : i === activeIndex ? "active" : "locked",
  }))

  const current = activeIndex === -1 ? null : railSteps[activeIndex]
  const position: GuidedPosition | null = current
    ? { index: activeIndex + 1, total }
    : null
  const next: GuidedTarget | null = current
    ? { key: current.key, label: current.label, href: current.href }
    : null
  const isLastStep = position != null && position.index === position.total

  return {
    status,
    active: status === "guided" && !allDone,
    steps: railSteps,
    current,
    position,
    next,
    isLastStep,
    doneCount,
    total,
    allDone,
  }
}

// Helper serveur : combine le statut et la progression dérivée en un modèle de
// rail. Réutilise getOnboardingProgress (aucune requête ni état supplémentaire).
export async function getGuidedRail(
  landlordId: string,
  status: OnboardingStatus,
): Promise<GuidedRail> {
  const progress = await getOnboardingProgress(landlordId)
  return buildGuidedRail(status, progress)
}
