export function normalizePassword(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const password = value.trim()

  if (password.length < 8) return null

  return password
}

// Ranti starts in Benin: the owner enters only the local 10-digit number
// introduced by the national numbering update, e.g. 0197147402.
// We store it consistently with the international dialing code: +2290197147402.
export const BENIN_DIALING_CODE = "+229"

// A current Benin local number is exactly 10 digits and starts with 01.
const BENIN_LOCAL_PATTERN = /^01\d{8}$/

export function normalizePhone(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const raw = value.replace(/\s+/g, "").trim()
  if (raw === "") return null

  let local: string
  if (raw.startsWith(BENIN_DIALING_CODE)) {
    // Be defensive if a browser/autofill sends the country code, but the UI must
    // keep asking for the local 10-digit number only.
    local = raw.slice(BENIN_DIALING_CODE.length)
  } else if (raw.startsWith("+")) {
    // Benin only at the MVP — reject any other country code.
    return null
  } else {
    local = raw.replace(/\D/g, "")
  }

  if (!BENIN_LOCAL_PATTERN.test(local)) return null

  return `${BENIN_DIALING_CODE}${local}`
}

// Group a local number into pairs for display: 0190000000 -> "01 90 00 00 00".
export function formatLocalPhone(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 10)
    .replace(/(\d{2})(?=\d)/g, "$1 ")
    .trim()
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
