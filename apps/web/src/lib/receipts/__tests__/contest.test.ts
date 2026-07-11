import { describe, expect, it } from "vitest"
import { parseContestInput } from "../contest"

describe("parseContestInput", () => {
  it("rejette une nature inconnue", () => {
    expect(parseContestInput({ nature: "", amount: "", period: "" })).toEqual({
      ok: false,
      error: "invalid_nature",
    })
    expect(parseContestInput({ nature: "whatever", amount: "", period: "" })).toEqual({
      ok: false,
      error: "invalid_nature",
    })
  })

  it("not_paid : ni montant ni période", () => {
    expect(parseContestInput({ nature: "not_paid", amount: "999", period: "juin" })).toEqual({
      ok: true,
      nature: "not_paid",
      amount: null,
      period: null,
    })
  })

  it("amount : parse le montant, ignore les espaces", () => {
    expect(parseContestInput({ nature: "amount", amount: "50 000", period: "" })).toEqual({
      ok: true,
      nature: "amount",
      amount: 50000,
      period: null,
    })
  })

  it("amount : 0 accepté, période ignorée", () => {
    const r = parseContestInput({ nature: "amount", amount: "0", period: "juin" })
    expect(r).toEqual({ ok: true, nature: "amount", amount: 0, period: null })
  })

  it("amount : vide ou non numérique rejeté", () => {
    expect(parseContestInput({ nature: "amount", amount: "", period: "" })).toEqual({
      ok: false,
      error: "amount_invalid",
    })
    expect(parseContestInput({ nature: "amount", amount: "abc", period: "" })).toEqual({
      ok: false,
      error: "amount_invalid",
    })
  })

  it("amount : négatif ou hors borne rejeté", () => {
    expect(parseContestInput({ nature: "amount", amount: "-5", period: "" }).ok).toBe(false)
    expect(parseContestInput({ nature: "amount", amount: "100000001", period: "" })).toEqual({
      ok: false,
      error: "amount_invalid",
    })
  })

  it("date : conserve la période, trim, montant ignoré", () => {
    expect(parseContestInput({ nature: "date", amount: "999", period: "  juin 2026 " })).toEqual({
      ok: true,
      nature: "date",
      amount: null,
      period: "juin 2026",
    })
  })

  it("date : période vide devient null", () => {
    expect(parseContestInput({ nature: "date", amount: "", period: "   " })).toEqual({
      ok: true,
      nature: "date",
      amount: null,
      period: null,
    })
  })

  it("date : période trop longue rejetée", () => {
    expect(parseContestInput({ nature: "date", amount: "", period: "x".repeat(121) })).toEqual({
      ok: false,
      error: "period_invalid",
    })
  })
})
