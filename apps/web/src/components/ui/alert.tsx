// Bandeaux d'état Ranti — source unique (le même message d'erreur était
// copié-collé ~15 fois avec des variantes divergentes). Tokens uniquement :
// les deux thèmes suivent.
import type { ReactNode } from "react"

export type AlertVariant = "error" | "success" | "info" | "warning"

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "border-destructive/25 bg-destructive/10 text-destructive",
  success: "border-primary/15 bg-secondary text-foreground",
  info: "border-accent/40 bg-accent/10 text-accent",
  warning: "border-warning/40 bg-warning/10 text-warning",
}

export function Alert({
  variant,
  children,
  className = "",
}: {
  variant: AlertVariant
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={`rounded-2xl border px-5 py-4 text-sm leading-6 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {children}
    </div>
  )
}
