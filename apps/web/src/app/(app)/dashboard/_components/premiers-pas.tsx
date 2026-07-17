import Link from "next/link"
import type { OnboardingProgress } from "@/lib/onboarding/progress"

// Checklist « Premiers pas » de la prise en main guidée (FirstRun). État de
// chaque étape dérivé des données réelles ; l'étape active = première non faite
// (une étape faite reste cochée même si une antérieure ne l'est pas). Chaque
// ligne pointe vers le vrai écran. Jamais bloquant : le reste du tableau de bord
// reste utilisable en dessous.
export function PremiersPas({ progress }: { progress: OnboardingProgress }) {
  const { steps, total, doneCount } = progress
  const title = doneCount === 0 ? "Activez votre espace" : "Presque prêt"
  const sub =
    doneCount === 0
      ? "Quelques gestes, et Ranti prend le relais."
      : "Continuez, il ne reste qu'un geste."
  const activeIndex = steps.findIndex((s) => !s.done)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(91,111,0,0.10),0_10px_24px_-12px_rgba(91,111,0,0.28)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
        <span className="flex-shrink-0 font-display text-lg font-extrabold tabular-nums text-accent">
          {doneCount}/{total}
        </span>
      </div>

      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const state = step.done ? "done" : i === activeIndex ? "active" : "locked"
          return (
            <li key={step.key} className="border-t border-border first:border-t-0">
              <Link
                href={step.href}
                className="flex items-start gap-3.5 px-5 py-4 transition hover:bg-secondary/50 sm:px-6"
              >
                <StepCircle state={state} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={
                      state === "done"
                        ? "text-[0.95rem] font-medium text-muted-foreground line-through decoration-border"
                        : "text-[0.95rem] font-semibold text-foreground"
                    }
                  >
                    {step.label}
                  </span>
                  <span className="text-[0.82rem] leading-snug text-muted-foreground">
                    {step.desc}
                  </span>
                </span>
                {state !== "done" && (
                  <span aria-hidden className="ml-auto self-center text-lg leading-none text-muted-foreground">
                    ›
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function StepCircle({ state }: { state: "done" | "active" | "locked" }) {
  if (state === "done") {
    return (
      <span className="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M5 12.5l4 4 10-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }
  if (state === "active") {
    return (
      <span className="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-accent">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </span>
    )
  }
  return (
    <span className="mt-px h-6 w-6 flex-shrink-0 rounded-full border-2 border-border" />
  )
}
