export function normalizePassword(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const password = value.trim()

  if (password.length < 8) return null

  return password
}

// Ranti starts in Benin: the dialing code is fixed and never entered by the
// owner, who types only their local number (e.g. 0197147402).
export const BENIN_DIALING_CODE = "+229"

export function normalizePhone(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const phone = value.replace(/\s+/g, "").trim()
  if (phone === "") return null

  // Already international (e.g. a value round-tripped from a previous submit).
  if (phone.startsWith("+")) {
    return phone.length >= 8 ? phone : null
  }

  // Local Benin number: digits only, prefixed with the fixed dialing code.
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 8) return null

  return `${BENIN_DIALING_CODE}${digits}`
}

// Display helper: strip the fixed dialing code so the field shows only the
// local part the owner typed.
export function toLocalPhone(value: string): string {
  if (value === "") return ""
  if (value.startsWith(BENIN_DIALING_CODE)) return value.slice(BENIN_DIALING_CODE.length)
  return value
}

export function normalizeOtp(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const code = value.replace(/\s+/g, "")

  if (!/^\d{6}$/.test(code)) return null

  return code
}

export function normalizeName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const name = value.trim().replace(/\s+/g, " ")

  if (name.length < 2) return null
  if (name.length > 80) return null

  return name
}

export const CIVILITIES = ["mr", "mrs", "miss", "not_specified"] as const

export type Civility = (typeof CIVILITIES)[number]

export function normalizeCivility(value: FormDataEntryValue | null): Civility | null {
  if (typeof value !== "string") return null

  const civility = value.trim().toLowerCase()

  return (CIVILITIES as readonly string[]).includes(civility) ? (civility as Civility) : null
}
