import { describe, it, expect } from "vitest"
import { normalizeRentAmount, normalizeDueDay, normalizeDate, normalizeCurrency } from "../validation"

describe("normalizeRentAmount", () => {
  it("accepts valid integer amounts", () => {
    expect(normalizeRentAmount("50000")).toBe(50000)
    expect(normalizeRentAmount("100000")).toBe(100000)
    expect(normalizeRentAmount("1")).toBe(1)
  })

  it("strips spaces", () => {
    expect(normalizeRentAmount("50 000")).toBe(50000)
  })

  it("rejects non-numeric input", () => {
    expect(normalizeRentAmount("abc")).toBeNull()
    expect(normalizeRentAmount("50,000")).toBeNull()
  })

  it("rejects zero and negative amounts", () => {
    expect(normalizeRentAmount("0")).toBeNull()
    expect(normalizeRentAmount("-500")).toBeNull()
  })

  it("rejects floating-point amounts (XOF has no minor unit)", () => {
    expect(normalizeRentAmount("50000.50")).toBeNull()
  })

  it("rejects empty input", () => {
    expect(normalizeRentAmount("")).toBeNull()
    expect(normalizeRentAmount("   ")).toBeNull()
  })

  it("handles null", () => {
    expect(normalizeRentAmount(null)).toBeNull()
  })

  it("rejects non-string", () => {
    expect(normalizeRentAmount(50000 as unknown as string)).toBeNull()
  })
})

describe("normalizeDueDay", () => {
  it("accepts valid days 1-31", () => {
    expect(normalizeDueDay("1")).toBe(1)
    expect(normalizeDueDay("15")).toBe(15)
    expect(normalizeDueDay("31")).toBe(31)
  })

  it("rejects day < 1", () => {
    expect(normalizeDueDay("0")).toBeNull()
  })

  it("rejects day > 31", () => {
    expect(normalizeDueDay("32")).toBeNull()
  })

  it("rejects non-numeric", () => {
    expect(normalizeDueDay("abc")).toBeNull()
  })

  it("trims whitespace", () => {
    expect(normalizeDueDay("  5  ")).toBe(5)
  })

  it("handles null", () => {
    expect(normalizeDueDay(null)).toBeNull()
  })
})

describe("normalizeDate", () => {
  it("accepts valid ISO dates", () => {
    expect(normalizeDate("2026-06-15")).toBe("2026-06-15")
    expect(normalizeDate("2025-01-01")).toBe("2025-01-01")
  })

  it("rejects invalid dates (feb 31)", () => {
    expect(normalizeDate("2026-02-31")).toBeNull()
  })

  it("rejects invalid dates (apr 31)", () => {
    expect(normalizeDate("2026-04-31")).toBeNull()
  })

  it("rejects wrong format", () => {
    expect(normalizeDate("15/06/2026")).toBeNull()
    expect(normalizeDate("20260615")).toBeNull()
  })

  it("rejects empty", () => {
    expect(normalizeDate("")).toBeNull()
  })

  it("handles null", () => {
    expect(normalizeDate(null)).toBeNull()
  })
})

describe("normalizeCurrency", () => {
  it("accepts XOF", () => {
    expect(normalizeCurrency("XOF")).toBe("XOF")
  })

  it("defaults to XOF when empty", () => {
    expect(normalizeCurrency("")).toBe("XOF")
    expect(normalizeCurrency(null)).toBe("XOF")
  })

  it("rejects non-XOF currencies", () => {
    expect(normalizeCurrency("EUR")).toBeNull()
    expect(normalizeCurrency("USD")).toBeNull()
  })
})
