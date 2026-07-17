"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { setOnboardingStatus } from "@/lib/onboarding/actions"

// Rendu uniquement quand la prise en main est en cours (guided) ET que les
// quatre premiers pas sont faits : on bascule le statut en `done` (la checklist
// disparaît, le bouton « Reprendre » ne s'affiche plus). Persiste une fois puis
// rafraîchit. N'affiche rien.
export function OnboardingComplete() {
  const fired = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void setOnboardingStatus("done").then(() => router.refresh())
  }, [router])

  return null
}
