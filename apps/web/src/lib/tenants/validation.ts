function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null

  const text = value.trim().replace(/\s+/g, " ")

  if (!text) return null
  if (text.length > maxLength) return null

  return text
}

const BENIN_DIALING_CODE = "+229"
const BENIN_LOCAL_PATTERN = /^01\d{8}$/

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

// Required for Ranti's reminder promise. Store a current Benin number consistently.
export function normalizeTenantPhone(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const raw = value.replace(/\s+/g, "").trim()
  if (!raw) return null

  let local: string
  if (raw.startsWith(BENIN_DIALING_CODE)) {
    local = raw.slice(BENIN_DIALING_CODE.length)
  } else if (raw.startsWith("+")) {
    return null
  } else {
    local = raw.replace(/\D/g, "")
  }

  if (!BENIN_LOCAL_PATTERN.test(local)) return null

  return `${BENIN_DIALING_CODE}${local}`
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
