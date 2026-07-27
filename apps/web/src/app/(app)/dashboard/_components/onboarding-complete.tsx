"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { setOnboardingStatus } from "@/lib/onboarding/actions"

// Rendu uniquement quand la prise en main est en cours (guided) ET que les
// quatre premiers pas sont faits : on bascule le statut en `done` (la checklist
// disparaît, le bouton « Reprendre » ne s'affiche plus). N'affiche rien.
//
// Correctif 2026-07-27 : l'échec d'écriture était invisible. Le composant
// rafraîchissait quoi qu'il arrive, le statut restait `guided`, et le rail
// « Premiers pas » revenait à CHAQUE visite sans que rien n'explique pourquoi
// — un cul-de-sac silencieux sur l'écran d'accueil. On réessaie une fois (le
// cas courant est un réseau qui vacille), et on ne rafraîchit que si le statut
// est réellement enregistré : sinon le rail reste, ce qui est la vérité.
const RETRY_DELAY_MS = 1500

export function OnboardingComplete() {
  const fired = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    let cancelled = false

    async function persist() {
      let result = await setOnboardingStatus("done")

      if (!result.ok && !cancelled) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        if (cancelled) return
        result = await setOnboardingStatus("done")
      }

      if (cancelled) return
      if (result.ok) {
        router.refresh()
      } else {
        // Pas de rafraîchissement : il ne montrerait rien de nouveau et
        // masquerait le fait que le statut n'a pas été enregistré. Le rail
        // reste affiché, la prochaine visite retentera.
        console.error("OnboardingComplete: statut non enregistré après 2 tentatives")
      }
    }

    void persist()
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
