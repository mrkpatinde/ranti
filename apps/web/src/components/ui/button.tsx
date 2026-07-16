// Boutons Ranti — source unique des styles d'action (DESIGN.md : l'olive est
// l'equity CTA ; pills réservées aux CTA/badges ; cible tactile ≥ 44 px).
// `buttonClasses` sert les cas Link / SubmitButton ; <Button> les <button> nus.
import type { ButtonHTMLAttributes } from "react"

export type ButtonVariant =
  | "primary" // action principale de l'écran — olive, toujours
  | "secondary" // action secondaire — outline neutre
  | "destructive" // action dangereuse pleine (confirmation finale)
  | "destructive-outline" // action dangereuse d'entrée (ouvre la confirmation)

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground font-semibold transition hover:brightness-95",
  secondary:
    "border border-border bg-card text-foreground font-medium transition hover:border-primary",
  destructive:
    "bg-destructive text-destructive-foreground font-medium transition hover:bg-destructive/90",
  "destructive-outline":
    "border border-destructive/40 bg-card text-destructive font-medium transition hover:border-destructive",
}

export function buttonClasses(variant: ButtonVariant, extra = ""): string {
  return `inline-flex items-center justify-center rounded-full px-5 py-3 text-sm ${VARIANT_CLASSES[variant]} disabled:opacity-60 ${extra}`.trim()
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button {...props} className={buttonClasses(variant, className)} />
}
