// Bouton rond d'action (référence Moneco, décision CEO 2026-07-22). Exception
// cadrée à l'interdit « pas de bulles » de DESIGN.md : réservé au trio d'actions
// primaires du dashboard. Non-custodial (ADR-019/024) : ce sont des gestes
// réels (enregistrer un paiement, relancer, voir les quittances), jamais des
// verbes d'argent. Simple Link stylé, rendu côté serveur (lucide = SVG pur).
import Link from "next/link"
import type { ReactNode } from "react"

type CircleActionVariant = "filled" | "outline"

const CIRCLE_CLASSES: Record<CircleActionVariant, string> = {
  filled: "bg-accent text-accent-foreground hover:brightness-95",
  outline: "border border-border bg-card text-accent hover:border-primary",
}

export function CircleAction({
  href,
  label,
  icon,
  variant = "outline",
}: {
  href: string
  label: string
  icon: ReactNode
  variant?: CircleActionVariant
}) {
  return (
    <Link href={href} className="flex flex-1 flex-col items-center gap-2 text-center">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full transition ${CIRCLE_CLASSES[variant]}`}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-foreground lg:text-sm">{label}</span>
    </Link>
  )
}
