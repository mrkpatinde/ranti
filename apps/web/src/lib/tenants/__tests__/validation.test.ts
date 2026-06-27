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
  it("keeps a lenient free-form phone, collapsing spaces", () => {
    expect(normalizeTenantPhone("  01 90 00 00 00 ")).toBe("01 90 00 00 00")
  })
  it("returns null on empty", () => {
    expect(normalizeTenantPhone("   ")).toBeNull()
    expect(normalizeTenantPhone(null)).toBeNull()
  })
  it("rejects over 32 chars", () => {
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
