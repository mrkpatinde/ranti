import { describe, it, expect } from "vitest"
import {
  normalizePhone,
  normalizePassword,
  normalizeOtp,
  normalizeName,
  normalizeCivility,
} from "../validation"

const LOCAL_10 = "01" + "9".repeat(8) // 0199999999 — 10-digit Benin test number

describe("normalizePhone", () => {
  it("accepts Benin number with +229 prefix", () => {
    expect(normalizePhone(`+229${LOCAL_10}`)).toBe(`+229${LOCAL_10}`)
  })

  it("rejects bare 229 prefix without + (must be +229 or local 01)", () => {
    // The code requires either +229 (international) or 01XXXXXXXX (local).
    // A bare "229" prefix without "+" is rejected — this is by design.
    expect(normalizePhone(`229${LOCAL_10}`)).toBeNull()
  })

  it("accepts local Benin format 01XXXXXXXX", () => {
    expect(normalizePhone(LOCAL_10)).toBe(`+229${LOCAL_10}`)
  })

  it("adds +229 when missing", () => {
    expect(normalizePhone("0199999999")).toBe(`+229${"0199999999"}`)
  })

  it("rejects non-Benin international numbers (+33)", () => {
    expect(normalizePhone("+33612345678")).toBeNull()
  })

  it("rejects non-Benin international numbers (+1)", () => {
    expect(normalizePhone("+15551234567")).toBeNull()
  })

  it("rejects empty input", () => {
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone("   ")).toBeNull()
  })

  it("rejects too-short numbers", () => {
    expect(normalizePhone("0194")).toBeNull()
  })

  it("handles null/undefined gracefully", () => {
    expect(normalizePhone(null as unknown as string)).toBeNull()
    expect(normalizePhone(undefined as unknown as string)).toBeNull()
  })

  it("handles non-string input", () => {
    expect(normalizePhone(123 as unknown as string)).toBeNull()
  })
})

describe("normalizePassword", () => {
  it("accepts password >= 8 chars", () => {
    expect(normalizePassword("12345678")).toBe("12345678")
    expect(normalizePassword("abcdefgh")).toBe("abcdefgh")
  })

  it("trims whitespace", () => {
    expect(normalizePassword("  12345678  ")).toBe("12345678")
  })

  it("rejects password < 8 chars", () => {
    expect(normalizePassword("1234567")).toBeNull()
    expect(normalizePassword("abc")).toBeNull()
  })

  it("rejects empty password", () => {
    expect(normalizePassword("")).toBeNull()
    expect(normalizePassword("        ")).toBeNull()
  })

  it("handles null", () => {
    expect(normalizePassword(null)).toBeNull()
  })
})

describe("normalizeOtp", () => {
  it("accepts exactly 6 digits", () => {
    expect(normalizeOtp("123456")).toBe("123456")
  })

  it("strips spaces", () => {
    expect(normalizeOtp("123 456")).toBe("123456")
  })

  it("rejects non-6-digit input", () => {
    expect(normalizeOtp("12345")).toBeNull()
    expect(normalizeOtp("1234567")).toBeNull()
  })

  it("rejects letters", () => {
    expect(normalizeOtp("abc123")).toBeNull()
  })

  it("rejects empty input", () => {
    expect(normalizeOtp("")).toBeNull()
  })

  it("handles null", () => {
    expect(normalizeOtp(null)).toBeNull()
  })
})

describe("normalizeName", () => {
  it("accepts name between 2 and 80 chars", () => {
    expect(normalizeName("Jean")).toBe("Jean")
    expect(normalizeName("A".repeat(80))).toBe("A".repeat(80))
  })

  it("collapses multiple spaces", () => {
    expect(normalizeName("Jean   Marc")).toBe("Jean Marc")
  })

  it("trims whitespace", () => {
    expect(normalizeName("  Jean  ")).toBe("Jean")
  })

  it("rejects name < 2 chars", () => {
    expect(normalizeName("A")).toBeNull()
    expect(normalizeName("")).toBeNull()
  })

  it("rejects name > 80 chars", () => {
    expect(normalizeName("A".repeat(81))).toBeNull()
  })

  it("handles null", () => {
    expect(normalizeName(null)).toBeNull()
  })
})

describe("normalizeCivility", () => {
  it("accepts valid civilities", () => {
    expect(normalizeCivility("mr")).toBe("mr")
    expect(normalizeCivility("mrs")).toBe("mrs")
    expect(normalizeCivility("miss")).toBe("miss")
    expect(normalizeCivility("not_specified")).toBe("not_specified")
  })

  it("lowercases input", () => {
    expect(normalizeCivility("MR")).toBe("mr")
    expect(normalizeCivility("Mrs")).toBe("mrs")
  })

  it("trims whitespace", () => {
    expect(normalizeCivility("  mr  ")).toBe("mr")
  })

  it("rejects invalid civilities", () => {
    expect(normalizeCivility("dr")).toBeNull()
    expect(normalizeCivility("")).toBeNull()
    expect(normalizeCivility("prof")).toBeNull()
  })

  it("handles null", () => {
    expect(normalizeCivility(null)).toBeNull()
  })
})
