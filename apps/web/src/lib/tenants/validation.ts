function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null

  const text = value.trim().replace(/\s+/g, " ")

  if (!text) return null
  if (text.length > maxLength) return null

  return text
}

export function normalizeTenantName(value: FormDataEntryValue | null) {
  const name = normalizeText(value, 80)

  if (!name || name.length < 2) return null

  return name
}

export function normalizeOptionalTenantText(
  value: FormDataEntryValue | null,
  maxLength: number
) {
  return normalizeText(value, maxLength)
}

// Phone is optional and not globally unique at the MVP (api.md Tenants).
// Kept lenient: trim and collapse spaces, no strict format.
export function normalizeTenantPhone(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const phone = value.replace(/\s+/g, " ").trim()

  if (!phone) return null
  if (phone.length > 32) return null

  return phone
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
