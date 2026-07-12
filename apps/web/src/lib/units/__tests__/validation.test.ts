import { describe, expect, it } from "vitest"
import { normalizeDefaultDueDay, normalizeDefaultRent } from "../validation"

// Loyer/jour par défaut du logement (ADR-016) : optionnels, un défaut de saisie.
describe("normalizeDefaultRent", () => {
  it("accepte un entier positif, espaces tolérés", () => {
    expect(normalizeDefaultRent("50000")).toBe(50000)
    expect(normalizeDefaultRent("50 000")).toBe(50000)
  })

  it("null si vide, non numérique, zéro ou négatif", () => {
    expect(normalizeDefaultRent("")).toBeNull()
    expect(normalizeDefaultRent("  ")).toBeNull()
    expect(normalizeDefaultRent("abc")).toBeNull()
    expect(normalizeDefaultRent("0")).toBeNull()
    expect(normalizeDefaultRent("-5")).toBeNull()
    expect(normalizeDefaultRent(null)).toBeNull()
  })
})

describe("normalizeDefaultDueDay", () => {
  it("accepte 1 à 31", () => {
    expect(normalizeDefaultDueDay("1")).toBe(1)
    expect(normalizeDefaultDueDay("5")).toBe(5)
    expect(normalizeDefaultDueDay("31")).toBe(31)
  })

  it("null hors bornes ou invalide", () => {
    expect(normalizeDefaultDueDay("0")).toBeNull()
    expect(normalizeDefaultDueDay("32")).toBeNull()
    expect(normalizeDefaultDueDay("")).toBeNull()
    expect(normalizeDefaultDueDay("x")).toBeNull()
    expect(normalizeDefaultDueDay(null)).toBeNull()
  })
})
