// Countries where a landlord can create a Ranti space.
//
// Benin is the launch country: signup by phone + password (primary) or Google.
// Senegal and Côte d'Ivoire open with Google (email) signup ONLY — phone
// signup is not available there yet because SMS OTP delivery is not wired for
// those countries. The numbering plans below are still recorded so tenant
// phone capture and future phone signup can validate local numbers.
//
// Numbering plans (mobile only — Ranti reaches owners/tenants on mobile):
// - Benin (+229): 10-digit local numbers since the 2021 national update,
//   mobile numbers start with 01. E.g. 0197147402.
// - Senegal (+221): closed 9-digit plan, mobile prefixes 70, 75, 76, 77, 78
//   (Expresso, MVNO, Free/Yas, Orange, Orange). E.g. 771234567.
// - Côte d'Ivoire (+225): 10-digit plan since January 2021 (ARTCI PNN10),
//   mobile prefixes 01 (Moov), 05 (MTN), 07 (Orange). E.g. 0712345678.

export type SignupMethod = "phone_password" | "google"

export type CountryCode = "BJ" | "SN" | "CI"

export type Country = {
  code: CountryCode
  name: string
  flag: string
  dialingCode: string
  // Local mobile number: exact digit count and valid prefixes.
  localDigits: number
  localMobilePattern: RegExp
  // Example shown as input placeholder, grouped for readability.
  placeholder: string
  signupMethods: readonly SignupMethod[]
}

export const COUNTRIES: readonly Country[] = [
  {
    code: "BJ",
    name: "Bénin",
    flag: "🇧🇯",
    dialingCode: "+229",
    localDigits: 10,
    localMobilePattern: /^01\d{8}$/,
    placeholder: "01 90 00 00 00",
    signupMethods: ["phone_password", "google"],
  },
  {
    code: "SN",
    name: "Sénégal",
    flag: "🇸🇳",
    dialingCode: "+221",
    localDigits: 9,
    localMobilePattern: /^7[05678]\d{7}$/,
    placeholder: "77 123 45 67",
    signupMethods: ["google"],
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    dialingCode: "+225",
    localDigits: 10,
    localMobilePattern: /^0[157]\d{8}$/,
    placeholder: "07 12 34 56 78",
    signupMethods: ["google"],
  },
] as const

export const DEFAULT_COUNTRY_CODE: CountryCode = "BJ"

export function getCountry(code: string | null | undefined): Country | null {
  if (!code) return null
  return COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? null
}

export function supportsPhoneSignup(country: Country): boolean {
  return country.signupMethods.includes("phone_password")
}

// Resolve the country of a stored E.164 number by its dialing code.
// Dialing codes in the registry are prefix-free between each other
// (+229 / +221 / +225), so the first match is the only match.
export function countryForPhone(value: string | null | undefined): Country | null {
  if (!value) return null
  return COUNTRIES.find((c) => value.startsWith(c.dialingCode)) ?? null
}

// Validate a landlord/tenant mobile number for a given country and return it
// in E.164 (`+22901…`). Accepts the local number with optional spaces, or the
// E.164 form with the country's own dialing code; any other dialing code is
// rejected. Returns null when the number is not a valid mobile for `country`.
export function normalizeCountryPhone(
  country: Country,
  value: FormDataEntryValue | null,
): string | null {
  if (typeof value !== "string") return null

  const raw = value.replace(/\s+/g, "").trim()
  if (raw === "") return null

  let local: string
  if (raw.startsWith(country.dialingCode)) {
    local = raw.slice(country.dialingCode.length)
  } else if (raw.startsWith("+")) {
    return null
  } else {
    local = raw
  }

  local = local.replace(/\D/g, "")
  if (!country.localMobilePattern.test(local)) return null

  return `${country.dialingCode}${local}`
}

// Display helper for a stored E.164 number: "+221 77 123 45 67".
// Unknown dialing codes fall back to the raw stored value.
export function formatPhoneForDisplay(value: string): string {
  const country = countryForPhone(value)
  if (!country) return value

  const local = formatCountryLocalPhone(country, toCountryLocalPhone(country, value))
  return `${country.dialingCode} ${local}`
}

// Strip the country's dialing code so a field shows only the local part.
export function toCountryLocalPhone(country: Country, value: string): string {
  if (value.startsWith(country.dialingCode)) return value.slice(country.dialingCode.length)
  return value
}

// Group local digits the way the country's placeholder does, e.g. Sénégal
// "77 123 45 67" groups 2-3-2-2. Extra digits beyond the plan are dropped.
export function formatCountryLocalPhone(country: Country, value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, country.localDigits)
  const groups = country.placeholder.split(" ").map((g) => g.length)

  const parts: string[] = []
  let index = 0
  for (const size of groups) {
    if (index >= digits.length) break
    parts.push(digits.slice(index, index + size))
    index += size
  }

  return parts.join(" ")
}
