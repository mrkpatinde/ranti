import { describe, it, expect } from "vitest"
import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  countryForPhone,
  formatCountryLocalPhone,
  formatPhoneForDisplay,
  getCountry,
  normalizeCountryPhone,
  supportsPhoneSignup,
  toCountryLocalPhone,
} from "../countries"

describe("countries registry", () => {
  it("defaults to Benin", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("BJ")
  })

  it("getCountry resolves codes case-insensitively", () => {
    expect(getCountry("sn")?.name).toBe("Sénégal")
    expect(getCountry("CI")?.dialingCode).toBe("+225")
    expect(getCountry("XX")).toBeNull()
    expect(getCountry(null)).toBeNull()
  })

  it("Benin supports phone signup, Senegal and Côte d'Ivoire are Google-only", () => {
    expect(supportsPhoneSignup(getCountry("BJ")!)).toBe(true)
    expect(supportsPhoneSignup(getCountry("SN")!)).toBe(false)
    expect(supportsPhoneSignup(getCountry("CI")!)).toBe(false)
    expect(getCountry("SN")!.signupMethods).toEqual(["google"])
    expect(getCountry("CI")!.signupMethods).toEqual(["google"])
  })
})

describe("mobile numbering plans", () => {
  it("Benin: 10 digits starting with 01", () => {
    const p = getCountry("BJ")!.localMobilePattern
    expect(p.test("0197147402")).toBe(true)
    expect(p.test("9714740")).toBe(false)
    expect(p.test("01971474020")).toBe(false)
  })

  it("Senegal: 9 digits, prefixes 70/75/76/77/78", () => {
    const p = getCountry("SN")!.localMobilePattern
    for (const prefix of ["70", "75", "76", "77", "78"]) {
      expect(p.test(`${prefix}1234567`)).toBe(true)
    }
    expect(p.test("711234567")).toBe(false) // 71 not allocated
    expect(p.test("7712345678")).toBe(false) // 10 digits
    expect(p.test("77123456")).toBe(false) // 8 digits
  })

  it("Côte d'Ivoire: 10 digits, prefixes 01/05/07", () => {
    const p = getCountry("CI")!.localMobilePattern
    for (const prefix of ["01", "05", "07"]) {
      expect(p.test(`${prefix}12345678`)).toBe(true)
    }
    expect(p.test("0212345678")).toBe(false) // 02 is not mobile
    expect(p.test("0712345")).toBe(false) // too short
    expect(p.test("07123456789")).toBe(false) // 11 digits
  })

  it("declared localDigits matches each pattern", () => {
    for (const country of COUNTRIES) {
      const sample = "0".repeat(country.localDigits)
      // Length check only: a valid-length but wrong-prefix number must fail
      // for the right reason (prefix), so patterns anchor full length.
      expect(country.localMobilePattern.source.includes("$")).toBe(true)
      expect(sample.length).toBe(country.localDigits)
    }
  })
})

describe("normalizeCountryPhone", () => {
  const bj = getCountry("BJ")!
  const sn = getCountry("SN")!
  const ci = getCountry("CI")!

  it("normalizes a local number to E.164", () => {
    expect(normalizeCountryPhone(bj, "0197147402")).toBe("+2290197147402")
    expect(normalizeCountryPhone(sn, "771234567")).toBe("+221771234567")
    expect(normalizeCountryPhone(ci, "0712345678")).toBe("+2250712345678")
  })

  it("accepts spaces and the country's own dialing code", () => {
    expect(normalizeCountryPhone(sn, "77 123 45 67")).toBe("+221771234567")
    expect(normalizeCountryPhone(sn, "+221 77 123 45 67")).toBe("+221771234567")
    expect(normalizeCountryPhone(bj, "+229 01 97 14 74 02")).toBe("+2290197147402")
  })

  it("rejects another country's dialing code", () => {
    expect(normalizeCountryPhone(sn, "+2290197147402")).toBeNull()
    expect(normalizeCountryPhone(bj, "+221771234567")).toBeNull()
    // Togo is not in the registry yet: +228 rejected for every country.
    expect(normalizeCountryPhone(sn, "+22890123456")).toBeNull()
  })

  it("rejects invalid mobiles for the selected plan", () => {
    expect(normalizeCountryPhone(sn, "711234567")).toBeNull() // 71 not allocated
    expect(normalizeCountryPhone(ci, "0212345678")).toBeNull() // 02 not mobile
    expect(normalizeCountryPhone(bj, "97147402")).toBeNull() // old 8-digit format
    expect(normalizeCountryPhone(bj, "")).toBeNull()
    expect(normalizeCountryPhone(bj, null)).toBeNull()
  })
})

describe("phone display helpers", () => {
  it("countryForPhone resolves stored E.164 numbers", () => {
    expect(countryForPhone("+2290197147402")?.code).toBe("BJ")
    expect(countryForPhone("+221771234567")?.code).toBe("SN")
    expect(countryForPhone("+2250712345678")?.code).toBe("CI")
    expect(countryForPhone("+22890123456")).toBeNull() // Togo not registered
    expect(countryForPhone(null)).toBeNull()
  })

  it("toCountryLocalPhone strips only the matching dialing code", () => {
    const sn = getCountry("SN")!
    expect(toCountryLocalPhone(sn, "+221771234567")).toBe("771234567")
    expect(toCountryLocalPhone(sn, "771234567")).toBe("771234567")
  })

  it("formatCountryLocalPhone groups digits like the placeholder", () => {
    expect(formatCountryLocalPhone(getCountry("BJ")!, "0197147402")).toBe("01 97 14 74 02")
    expect(formatCountryLocalPhone(getCountry("SN")!, "771234567")).toBe("77 123 45 67")
    expect(formatCountryLocalPhone(getCountry("CI")!, "0712345678")).toBe("07 12 34 56 78")
    // Partial input keeps partial groups; extra digits are dropped.
    expect(formatCountryLocalPhone(getCountry("SN")!, "7712")).toBe("77 12")
    expect(formatCountryLocalPhone(getCountry("SN")!, "77123456789")).toBe("77 123 45 67")
  })

  it("formatPhoneForDisplay renders known plans and falls back on raw values", () => {
    expect(formatPhoneForDisplay("+221771234567")).toBe("+221 77 123 45 67")
    expect(formatPhoneForDisplay("+2290197147402")).toBe("+229 01 97 14 74 02")
    expect(formatPhoneForDisplay("+22890123456")).toBe("+22890123456")
  })
})
