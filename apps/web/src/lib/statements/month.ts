// Mois de clôture, manipulés en chaînes « YYYY-MM » — aucune dérive de fuseau
// (même règle que lib/format.ts : un mois n'a pas d'heure). Pur, sans I/O.

import { MONTHS_FR } from "@/lib/format"

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month)
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Mois en cours au format « YYYY-MM ». */
export function currentMonth(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}`
}

/** Premier jour du mois, seule forme acceptée par les RPC (`p_month date`). */
export function monthStartIso(month: string): string {
  return `${month}-01`
}

/** Décale un mois de `delta` mois (négatif = vers le passé). */
export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month)
  if (!m) return month
  const year = Number(m[1])
  const index = Number(m[2]) - 1 + delta
  const shiftedYear = year + Math.floor(index / 12)
  const shiftedMonth = ((index % 12) + 12) % 12
  return `${shiftedYear}-${pad(shiftedMonth + 1)}`
}

/** « 2026-08 » → « août 2026 ». Chaîne inchangée si le mois est invalide. */
export function monthLabel(month: string): string {
  const m = MONTH_RE.exec(month)
  if (!m) return month
  return `${MONTHS_FR[Number(m[2]) - 1]} ${m[1]}`
}

/**
 * Mois demandé, ramené à une valeur sûre : un mois valide et jamais dans le
 * futur (on ne clôture pas un mois qui n'a pas commencé). Défaut = mois en
 * cours.
 */
export function resolveMonth(raw: string | undefined, ref: Date = new Date()): string {
  const now = currentMonth(ref)
  if (!raw || !isValidMonth(raw)) return now
  return raw > now ? now : raw
}
