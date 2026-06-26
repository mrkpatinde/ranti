export function normalizePassword(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const password = value.trim()

  if (password.length < 8) return null

  return password
}

export function normalizePhone(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const phone = value.replace(/\s+/g, "").trim()

  if (!phone.startsWith("+")) return null
  if (phone.length < 8) return null

  return phone
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
