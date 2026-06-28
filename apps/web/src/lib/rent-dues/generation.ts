// Spec exécutable miroir de la génération des échéances.
//
// ⚠️ SOURCE DE VÉRITÉ = la fonction SQL `public.generate_rent_dues`
// (migration 20260628150000_rent_due_invariants.sql). Ce module N'EST PAS
// utilisé dans le chemin de production : la génération réelle se fait en
// Postgres via RPC. Il existe pour figer la règle métier (ADR-004) en tests
// CI rapides. Toute divergence avec le SQL est un bug — voir le test SQL
// transactionnel `supabase/tests/rent_due_generation.sql`.
//
// Règle (ADR-004) :
//  1. day(start) <= due_day        -> 1re échéance ce mois
//  2. day(start) > due_day         -> 1re échéance le mois suivant
//  3. mois sans le jour demandé    -> due_date = dernier jour du mois (clamp)
//  4. lease.end_date               -> aucune échéance après mois(end_date)
//  5. unicité (lease_id, period_start) -> dédup au niveau DB (hors de cette fn)
//  6. échéance avec paiement        -> jamais réécrite (protégé au niveau DB)

export type RentDuePeriod = {
  /** 1er jour du mois couvert, YYYY-MM-DD */
  period_start: string
  /** dernier jour du mois couvert, YYYY-MM-DD */
  period_end: string
  /** jour exigible, clampé dans le mois, YYYY-MM-DD */
  due_date: string
}

function daysInMonth(year: number, month1: number): number {
  // month1: 1-12. Day 0 of month+1 = last day of month.
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

function fmt(year: number, month1: number, day: number): string {
  const mm = String(month1).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

/** Parse 'YYYY-MM-DD' into {year, month1, day} without timezone drift. */
function parse(date: string): { year: number; month1: number; day: number } {
  const [y, m, d] = date.split("-").map(Number)
  return { year: y, month1: m, day: d }
}

/** Add `n` months to a (year, month1) pair. Returns first-of-month. */
function addMonths(year: number, month1: number, n: number): { year: number; month1: number } {
  const zero = year * 12 + (month1 - 1) + n
  return { year: Math.floor(zero / 12), month1: (zero % 12) + 1 }
}

function monthIndex(year: number, month1: number): number {
  return year * 12 + (month1 - 1)
}

/**
 * Compute the set of monthly rent due periods for a lease, exactly mirroring
 * `public.generate_rent_dues`. Pure: no DB, no Date-timezone surprises.
 *
 * @param startDate lease start, 'YYYY-MM-DD'
 * @param dueDay    1-31, day rent is due
 * @param endDate   lease end or null, 'YYYY-MM-DD'
 * @param today     reference "now", 'YYYY-MM-DD' (generation horizon)
 */
export function computeRentDuePeriods(
  startDate: string,
  dueDay: number,
  endDate: string | null,
  today: string,
): RentDuePeriod[] {
  const start = parse(startDate)
  const now = parse(today)

  // Borne basse = mois du début, décalée +1 si le début dépasse le jour d'échéance.
  let first = { year: start.year, month1: start.month1 }
  if (start.day > dueDay) {
    first = addMonths(first.year, first.month1, 1)
  }

  // Borne haute = max(premier mois, mois courant), puis cap par end_date.
  let last = { year: now.year, month1: now.month1 }
  if (monthIndex(first.year, first.month1) > monthIndex(last.year, last.month1)) {
    last = { ...first }
  }
  if (endDate) {
    const end = parse(endDate)
    if (monthIndex(end.year, end.month1) < monthIndex(last.year, last.month1)) {
      last = { year: end.year, month1: end.month1 }
    }
  }

  const out: RentDuePeriod[] = []
  let cursor = { ...first }
  while (monthIndex(cursor.year, cursor.month1) <= monthIndex(last.year, last.month1)) {
    const dim = daysInMonth(cursor.year, cursor.month1)
    const dueClamped = Math.min(dueDay, dim) // cas 3
    out.push({
      period_start: fmt(cursor.year, cursor.month1, 1),
      period_end: fmt(cursor.year, cursor.month1, dim),
      due_date: fmt(cursor.year, cursor.month1, dueClamped),
    })
    cursor = addMonths(cursor.year, cursor.month1, 1)
  }
  return out
}
