"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { setOnboardingStatus } from "@/lib/onboarding/actions"

// Accueil non bloquant (welcome-flow.md) : « Commencer la configuration » lance
// la prise en main guidée, « Passer pour l'instant » (bouton, croix, Échap)
// ouvre le tableau de bord vide honnête. On masque en optimiste puis on persiste
// le choix ; le rafraîchissement révèle l'état suivant.
const WELCOME_STEPS = [
  "Enregistrez votre premier bail — logement, occupant, loyer.",
  "Validez un paiement dès que vous l'avez encaissé.",
  "Ranti édite la quittance ; votre locataire la confirme.",
  "Programmez une relance WhatsApp le jour de l'échéance.",
]

export function WelcomeOverlay({ firstName }: { firstName: string }) {
  const [dismissed, setDismissed] = useState(false)
  const decided = useRef(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Un seul choix : après « Commencer » ou « Passer », l'overlay rend null mais
  // reste monté le temps du refresh serveur ; sans ce garde, un Échap pendant
  // cette fenêtre écraserait « guided » par « exploring ».
  function choose(next: "guided" | "exploring") {
    if (decided.current) return
    decided.current = true
    setDismissed(true)
    startTransition(async () => {
      await setOnboardingStatus(next)
      router.refresh()
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") choose("exploring")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dismissed) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
    >
      <div className="lp-rise relative w-full max-w-[460px] rounded-[22px] border border-border bg-card p-7 shadow-[0_1px_2px_rgba(41,41,41,0.06),0_24px_60px_-24px_rgba(41,41,41,0.35)] sm:p-8">
        <button
          type="button"
          onClick={() => choose("exploring")}
          aria-label="Passer pour l'instant"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
        >
          <X size={16} strokeWidth={1.8} />
        </button>

        <div className="pr-8">
          <h1
            id="welcome-title"
            className="font-display text-[1.7rem] font-extrabold leading-tight tracking-tight text-foreground sm:text-[1.85rem]"
          >
            Bienvenue dans votre espace, {firstName}.
          </h1>
          <p className="mt-2.5 text-base leading-relaxed text-muted-foreground">
            Voici votre registre de loyer. En quelques gestes, il se met à
            travailler pour vous.
          </p>
        </div>

        <ol className="mt-6 flex flex-col gap-4">
          {WELCOME_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-secondary text-[0.82rem] font-bold tabular-nums text-accent">
                {i + 1}
              </span>
              <span className="text-[0.95rem] leading-relaxed text-foreground">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => choose("guided")}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-accent-foreground shadow-[0_1px_2px_rgba(91,111,0,0.22),0_8px_20px_-8px_rgba(91,111,0,0.38)] transition hover:brightness-105"
          >
            Commencer la configuration
          </button>
          <button
            type="button"
            onClick={() => choose("exploring")}
            className="rounded-full px-3 py-3.5 text-[0.95rem] font-medium text-muted-foreground transition hover:text-foreground"
          >
            Passer pour l&apos;instant
          </button>
        </div>
      </div>
    </div>
  )
}
