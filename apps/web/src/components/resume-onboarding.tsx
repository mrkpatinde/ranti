"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { setOnboardingStatus } from "@/lib/onboarding/actions"

// « Reprendre la prise en main » — relance le guidage depuis l'état exploration
// (« Passer pour l'instant »), à tout moment. Repasse le statut en `guided` et
// revient au tableau de bord. `pill` : barre latérale / menu mobile ; `link` :
// lien sobre dans l'état exploration du tableau de bord.
export function ResumeOnboarding({
  variant = "pill",
  onNavigate,
}: {
  variant?: "pill" | "link"
  onNavigate?: () => void
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function resume() {
    onNavigate?.()
    startTransition(async () => {
      await setOnboardingStatus("guided")
      router.push("/dashboard")
      router.refresh()
    })
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={resume}
        disabled={pending}
        className="text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground disabled:opacity-60"
      >
        Reprendre la prise en main guidée
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={resume}
      disabled={pending}
      className="mb-3 flex w-full items-center gap-2.5 rounded-full border-[1.5px] border-accent bg-secondary px-3.5 py-2 text-sm font-semibold text-accent transition hover:brightness-[0.98] disabled:opacity-60"
    >
      <Play size={14} strokeWidth={0} fill="currentColor" className="flex-shrink-0" />
      Reprendre la prise en main
    </button>
  )
}
