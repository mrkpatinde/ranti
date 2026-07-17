// Badges de statut Ranti — source unique (chaque écran redessinait son chip
// avec forme et palette divergentes). Pill (DESIGN.md : pills = CTA et badges).
import type { ReactNode } from "react"

export type BadgeVariant = "neutral" | "success" | "accent" | "warning" | "error"

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "border-border text-foreground/80",
  success: "border-primary/20 bg-secondary text-foreground",
  accent: "border-accent/50 bg-accent/10 text-accent",
  warning: "border-warning/50 bg-warning/10 text-warning",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function badgeClasses(variant: BadgeVariant, extra = ""): string {
  return `inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${VARIANT_CLASSES[variant]} ${extra}`.trim()
}

export function Badge({
  variant,
  children,
  className = "",
}: {
  variant: BadgeVariant
  children: ReactNode
  className?: string
}) {
  return <span className={badgeClasses(variant, className)}>{children}</span>
}
