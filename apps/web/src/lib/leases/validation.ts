// Rent amount is an integer (XOF has no minor unit at the MVP).
export function normalizeRentAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const raw = value.replace(/\s/g, "")
  if (!/^\d+$/.test(raw)) return null

  const amount = Number.parseInt(raw, 10)
  if (!Number.isInteger(amount) || amount <= 0) return null

  return amount
}

export function normalizeDueDay(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null
  if (!/^\d+$/.test(value.trim())) return null

  const day = Number.parseInt(value.trim(), 10)
  if (day < 1 || day > 31) return null

  return day
}

export function normalizeDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const date = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  // Reject values normalized away by JS (e.g. 2026-02-31).
  if (parsed.toISOString().slice(0, 10) !== date) return null

  return date
}

// XOF only at the MVP (api.md cross-cutting validation).
export function normalizeCurrency(value: FormDataEntryValue | null) {
  if (value == null || value === "") return "XOF"
  return value === "XOF" ? "XOF" : null
}

export function normalizeOptionalLeaseText(
  value: FormDataEntryValue | null,
  maxLength: number
) {
  if (typeof value !== "string") return null

  const text = value.trim().replace(/\s+/g, " ")
  if (!text) return null
  if (text.length > maxLength) return null

  return text
}
