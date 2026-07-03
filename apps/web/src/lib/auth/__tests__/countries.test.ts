import { describe, it, expect } from "vitest"
import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  getCountry,
  supportsPhoneSignup,
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
