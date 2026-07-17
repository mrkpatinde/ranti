import { describe, expect, it } from "vitest"
import { parseChargeContestInput } from "../contest"

describe("parseChargeContestInput (ADR-023 — contestation d'une charge)", () => {
  it("nature amount : montant requis, entier, espaces tolérés", () => {
    expect(
      parseChargeContestInput({ nature: "amount", amount: "3 000", comment: "" }),
    ).toEqual({ ok: true, nature: "amount", amount: 3000, comment: null })
    expect(parseChargeContestInput({ nature: "amount", amount: "", comment: "" })).toEqual({
      ok: false,
      error: "amount_invalid",
    })
    expect(parseChargeContestInput({ nature: "amount", amount: "-5", comment: "" })).toEqual({
      ok: false,
      error: "amount_invalid",
    })
  })

  it("les autres natures n'exigent aucun montant et l'ignorent", () => {
    for (const nature of ["not_owed", "already_paid", "other"] as const) {
      expect(parseChargeContestInput({ nature, amount: "999", comment: " ok " })).toEqual({
        ok: true,
        nature,
        amount: null,
        comment: "ok",
      })
    }
  })

  it("nature inconnue refusée ; commentaire borné à 500", () => {
    expect(parseChargeContestInput({ nature: "date", amount: "", comment: "" })).toEqual({
      ok: false,
      error: "invalid_nature",
    })
    expect(
      parseChargeContestInput({ nature: "other", amount: "", comment: "x".repeat(501) }),
    ).toEqual({ ok: false, error: "comment_too_long" })
  })
})
