export function normalizeEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const email = value.trim().toLowerCase()

  if (!email) return null

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return isValid ? email : null
}

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