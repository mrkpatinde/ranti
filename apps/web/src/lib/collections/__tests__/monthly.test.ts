import { describe, expect, it } from "vitest"
import { isReceivedInMonth, monthRange, sumCollectedInMonth } from "../monthly"

const june = new Date(2026, 5, 15)
const range = monthRange(june)

function reception(overrides: Partial<Parameters<typeof sumCollectedInMonth>[0][number]> = {}) {
  return {
    status: "confirmed",
    deleted_at: null,
    received_at: new Date(2026, 5, 10).toISOString(),
    rent_reception_allocations: [{ amount_allocated: 50000 }],
    ...overrides,
  }
}

describe("monthRange", () => {
  it("couvre du 1er du mois au 1er du mois suivant", () => {
    expect(range.start).toEqual(new Date(2026, 5, 1))
    expect(range.end).toEqual(new Date(2026, 6, 1))
  })
})

describe("isReceivedInMonth", () => {
  it("inclut le 1er du mois, exclut le 1er du mois suivant", () => {
    expect(isReceivedInMonth(new Date(2026, 5, 1).toISOString(), range)).toBe(true)
    expect(isReceivedInMonth(new Date(2026, 6, 1).toISOString(), range)).toBe(false)
  })
})

describe("sumCollectedInMonth", () => {
  it("inclut un paiement reçu ce mois", () => {
    expect(sumCollectedInMonth([reception()], range)).toEqual({ amount: 50000, count: 1 })
  })

  it("exclut un paiement reçu le mois précédent", () => {
    const previous = reception({ received_at: new Date(2026, 4, 28).toISOString() })
    expect(sumCollectedInMonth([previous], range)).toEqual({ amount: 0, count: 0 })
  })

  it("compte seulement le montant partiel alloué", () => {
    const partial = reception({ rent_reception_allocations: [{ amount_allocated: 20000 }] })
    expect(sumCollectedInMonth([partial], range)).toEqual({ amount: 20000, count: 1 })
  })

  it("exclut une réception draft", () => {
    expect(sumCollectedInMonth([reception({ status: "draft" })], range)).toEqual({ amount: 0, count: 0 })
  })

  it("exclut une réception cancelled", () => {
    expect(sumCollectedInMonth([reception({ status: "cancelled" })], range)).toEqual({ amount: 0, count: 0 })
  })

  it("exclut une réception supprimée", () => {
    const deleted = reception({ deleted_at: new Date(2026, 5, 12).toISOString() })
    expect(sumCollectedInMonth([deleted], range)).toEqual({ amount: 0, count: 0 })
  })

  it("additionne les allocations multiples d'une réception", () => {
    const multi = reception({
      rent_reception_allocations: [{ amount_allocated: 20000 }, { amount_allocated: 15000 }],
    })
    expect(sumCollectedInMonth([multi], range)).toEqual({ amount: 35000, count: 1 })
  })

  it("une échéance ancienne payée ce mois compte (received_at fait foi)", () => {
    // L'échéance peut dater de janvier : seul received_at du mois compte.
    expect(sumCollectedInMonth([reception()], range).amount).toBe(50000)
  })
})
