export function formatFcfa(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.trunc(amount) : 0
  const formatted = Math.abs(safeAmount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")

  return `${safeAmount < 0 ? "-" : ""}${formatted} FCFA`
}
