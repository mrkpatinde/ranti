import { describe, it, expect } from "vitest"
import {
  isEmail,
  normalizeOptionalTenantText,
  normalizeTenantName,
  normalizeTenantPhone,
} from "../validation"

describe("normalizeTenantName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeTenantName("  Awa   Koffi ")).toBe("Awa Koffi")
  })
  it("rejects names shorter than 2 chars", () => {
    expect(normalizeTenantName("A")).toBeNull()
    expect(normalizeTenantName("")).toBeNull()
  })
  it("rejects names over 80 chars", () => {
    expect(normalizeTenantName("x".repeat(81))).toBeNull()
  })
  it("rejects non-string input", () => {
    expect(normalizeTenantName(null)).toBeNull()
  })
})

describe("normalizeTenantPhone", () => {
  it("normalizes a Benin local number to E.164", () => {
    expect(normalizeTenantPhone("  01 90 00 00 00 ")).toBe("+2290190000000")
  })
  it("accepts a number already prefixed with +229", () => {
    expect(normalizeTenantPhone("+229 01 90 00 00 00")).toBe("+2290190000000")
  })
  it("rejects foreign international prefixes", () => {
    expect(normalizeTenantPhone("+33 6 12 34 56 78")).toBeNull()
  })
  it("returns null on empty", () => {
    expect(normalizeTenantPhone("   ")).toBeNull()
    expect(normalizeTenantPhone(null)).toBeNull()
  })
  it("rejects local numbers that do not match the Benin pattern", () => {
    expect(normalizeTenantPhone("9".repeat(33))).toBeNull()
  })
})

describe("normalizeOptionalTenantText", () => {
  it("returns null when empty", () => {
    expect(normalizeOptionalTenantText("", 100)).toBeNull()
  })
  it("rejects over the max length", () => {
    expect(normalizeOptionalTenantText("x".repeat(11), 10)).toBeNull()
  })
  it("normalizes valid text", () => {
    expect(normalizeOptionalTenantText("  a  b ", 100)).toBe("a b")
  })
})

describe("isEmail", () => {
  it("accepts a plausible address", () => {
    expect(isEmail("awa@email.com")).toBe(true)
  })
  it("rejects malformed addresses", () => {
    expect(isEmail("awa@")).toBe(false)
    expect(isEmail("awa.com")).toBe(false)
    expect(isEmail("a @b.com")).toBe(false)
  })
})
