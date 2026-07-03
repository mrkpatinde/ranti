// « Encaissé ce mois » = argent confirmé REÇU pendant le mois affiché.
// Source de vérité : les allocations des réceptions confirmées, non
// supprimées, dont received_at tombe dans le mois. Une échéance ancienne
// payée ce mois compte ; une échéance payée le mois dernier ne compte pas.

export type MonthlyReception = {
  status: string
  deleted_at: string | null
  received_at: string
  rent_reception_allocations: { amount_allocated: number }[]
}

export function monthRange(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  return { start, end }
}

export function isReceivedInMonth(receivedAt: string, range: { start: Date; end: Date }): boolean {
  const at = new Date(receivedAt).getTime()
  return at >= range.start.getTime() && at < range.end.getTime()
}

export function sumCollectedInMonth(
  receptions: MonthlyReception[],
  range: { start: Date; end: Date }
): { amount: number; count: number } {
  let amount = 0
  let count = 0
  for (const reception of receptions) {
    if (reception.status !== "confirmed") continue
    if (reception.deleted_at !== null) continue
    if (!isReceivedInMonth(reception.received_at, range)) continue
    const allocated = reception.rent_reception_allocations.reduce(
      (total, allocation) => total + allocation.amount_allocated,
      0
    )
    if (allocated <= 0) continue
    amount += allocated
    count += 1
  }
  return { amount, count }
}
