"use client"

// Contexte du parcours FirstRun (phase 3) : porte l'identite reelle du bailleur
// connecte (fini le seed Florentine) et les actions serveur asynchrones qui
// doivent RENVOYER un resultat avant de faire avancer le reducer (creation de
// bail, validation de paiement). Les effets « fire-and-forget » (statut
// d'onboarding, relances, deconnexion) restent dans le dispatch enveloppe.

import { createContext, useContext } from "react"
import type {
  FirstRunBailInput,
  FirstRunBailResult,
  FirstRunPaymentInput,
  FirstRunPaymentResult,
} from "./actions"

export type FirstRunLandlord = {
  firstName: string
  fullName: string
  initials: string
}

export type FirstRunContextValue = {
  landlord: FirstRunLandlord
  monthLabel: string // « juillet 2026 », calcule cote serveur (pas d'hydratation)
  todayIso: string // date du jour AAAA-MM-JJ pour le champ « Date de reception »
  createBail: (input: FirstRunBailInput) => Promise<FirstRunBailResult>
  recordPayment: (input: FirstRunPaymentInput) => Promise<FirstRunPaymentResult>
}

const FirstRunContext = createContext<FirstRunContextValue | null>(null)

export function FirstRunProvider({
  value,
  children,
}: {
  value: FirstRunContextValue
  children: React.ReactNode
}) {
  return <FirstRunContext.Provider value={value}>{children}</FirstRunContext.Provider>
}

export function useFirstRun(): FirstRunContextValue {
  const ctx = useContext(FirstRunContext)
  if (!ctx) throw new Error("useFirstRun must be used within FirstRunProvider")
  return ctx
}
