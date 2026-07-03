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
