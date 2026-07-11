import type { ContestNature } from "./types"

// Validation pure de l'entrée de contestation locataire (ADR-013). Isolée de
// FormData / redirect pour être testable — l'action serveur extrait les chaînes
// brutes puis délègue ici.

export const VALID_CONTEST_NATURES = ["amount", "date", "not_paid"] as const

export type ContestParse =
  | { ok: true; nature: ContestNature; amount: number | null; period: string | null }
  | { ok: false; error: "invalid_nature" | "amount_invalid" | "period_invalid" }

const MAX_AMOUNT = 100_000_000
const MAX_PERIOD_LEN = 120

export function parseContestInput(input: {
  nature: string
  amount: string
  period: string
}): ContestParse {
  const nature = (VALID_CONTEST_NATURES as readonly string[]).includes(input.nature)
    ? (input.nature as ContestNature)
    : null
  if (!nature) return { ok: false, error: "invalid_nature" }

  // Montant réel requis seulement pour une contestation de montant.
  let amount: number | null = null
  if (nature === "amount") {
    const raw = input.amount.replace(/\s/g, "")
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AMOUNT) {
      return { ok: false, error: "amount_invalid" }
    }
    amount = parsed
  }

  // Période réelle requise seulement pour une contestation de date.
  let period: string | null = null
  if (nature === "date") {
    const trimmed = input.period.trim()
    if (trimmed.length > MAX_PERIOD_LEN) return { ok: false, error: "period_invalid" }
    period = trimmed || null
  }

  return { ok: true, nature, amount, period }
}
