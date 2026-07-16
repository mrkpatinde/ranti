// Validation pure du formulaire public de contestation d'une charge
// (ADR-023 §4). Miroir de lib/receipts/contest.ts (ADR-013), natures du
// grand livre : montant faux, dette non reconnue, déjà réglée, autre.

import type { LedgerContestNature } from "./types"

export type ChargeContestInput = {
  nature: string
  amount: string
  comment: string
}

export type ChargeContestParsed =
  | { ok: true; nature: LedgerContestNature; amount: number | null; comment: string | null }
  | { ok: false; error: "invalid_nature" | "amount_invalid" | "comment_too_long" }

const NATURES: LedgerContestNature[] = ["amount", "not_owed", "already_paid", "other"]

export function parseChargeContestInput(input: ChargeContestInput): ChargeContestParsed {
  if (!NATURES.includes(input.nature as LedgerContestNature)) {
    return { ok: false, error: "invalid_nature" }
  }
  const nature = input.nature as LedgerContestNature

  let amount: number | null = null
  if (nature === "amount") {
    const cleaned = input.amount.replace(/[\s ]/g, "")
    if (!/^\d+$/.test(cleaned)) return { ok: false, error: "amount_invalid" }
    amount = Number(cleaned)
    if (!Number.isSafeInteger(amount)) return { ok: false, error: "amount_invalid" }
  }

  const comment = input.comment.trim()
  if (comment.length > 500) return { ok: false, error: "comment_too_long" }

  return { ok: true, nature, amount, comment: comment || null }
}
