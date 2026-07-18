import Link from "next/link"
import { buttonClasses } from "@/components/ui/button"
import type { GuidedRail as GuidedRailData } from "@/lib/onboarding/guided"

// Rail de la prise en main guidée (FirstRun) — le stepper compact du prototype :
// une barre de segments (fait / actif / verrouillé), la position « Étape X sur Y »,
// le libellé + la description de l'étape courante, et le CTA « Continuer » vers le
// deep-link de la prochaine cible. Modèle SERVEUR dérivé (cf. guided.ts) : aucun
// état local, tout se recalcule au rendu. Complète la checklist PremiersPas en
// pointant sur le seul geste à faire maintenant. Jamais bloquant.
//
// Conformité DESIGN.md : pas d'eyebrow majuscule au-dessus du titre (tell slop) —
// « Étape X sur Y » / « Dernière étape » est un indicateur fonctionnel en casse
// de phrase, pas un kicker. Olive = token `accent`, filet track = `muted`.
export function GuidedRail({ rail }: { rail: GuidedRailData }) {
  const { steps, current, position, next, isLastStep } = rail
  // Présentationnel : rien à guider quand tout est fait (current/position/next nuls).
  if (!current || !position || !next) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(91,111,0,0.10),0_10px_24px_-12px_rgba(91,111,0,0.28)] sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {/* Segments : plein olive = fait, remplissage partiel = étape en cours,
              track nu = verrouillé. Décoratifs — la position ci-dessous porte le sens. */}
          <div aria-hidden className="flex gap-1.5">
            {steps.map((step) => (
              <span
                key={step.key}
                className="h-[5px] flex-1 overflow-hidden rounded-full bg-muted"
              >
                {step.state === "done" && (
                  <span className="block h-full w-full rounded-full bg-accent" />
                )}
                {step.state === "active" && (
                  <span className="block h-full w-[55%] rounded-full bg-accent" />
                )}
              </span>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {isLastStep ? "Dernière étape" : `Étape ${position.index} sur ${position.total}`}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {current.label}
          </h2>
          <p className="text-sm leading-snug text-muted-foreground">{current.desc}</p>
        </div>

        <Link href={next.href} className={buttonClasses("primary", "w-full sm:w-auto sm:self-start")}>
          Continuer
        </Link>
      </div>
    </section>
  )
}
