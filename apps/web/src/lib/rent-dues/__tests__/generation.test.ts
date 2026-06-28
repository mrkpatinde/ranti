import { describe, it, expect } from "vitest"
import { computeRentDuePeriods } from "../generation"

// Spec exécutable miroir (ADR-004). SQL = source de vérité ; ces tests
// figent la règle métier. due_day par défaut = 5 sauf mention.

describe("computeRentDuePeriods — règle ADR-004", () => {
  it("cas 1 : début <= jour d'échéance -> première échéance ce mois", () => {
    const r = computeRentDuePeriods("2026-01-03", 5, null, "2026-01-15")
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      due_date: "2026-01-05",
    })
  })

  it("cas 2 : début > jour d'échéance -> première échéance le mois suivant", () => {
    // Le bug historique : début 29 juin, due_day 5 -> doit démarrer en juillet.
    const r = computeRentDuePeriods("2026-06-29", 5, null, "2026-07-10")
    expect(r.map((p) => p.period_start)).toEqual(["2026-07-01"])
    expect(r[0].due_date).toBe("2026-07-05")
  })

  it("cas 3 : mois sans le jour demandé -> due_date = dernier jour du mois", () => {
    // due_day 31, février 2026 (28 jours) -> due_date clampée au 28.
    const r = computeRentDuePeriods("2026-02-01", 31, "2026-02-28", "2026-02-15")
    expect(r).toHaveLength(1)
    expect(r[0].due_date).toBe("2026-02-28")
    expect(r[0].period_end).toBe("2026-02-28")
  })

  it("cas 3 bis : février bissextile -> clamp au 29", () => {
    const r = computeRentDuePeriods("2024-02-01", 31, "2024-02-29", "2024-02-15")
    expect(r[0].due_date).toBe("2024-02-29")
  })

  it("cas 4 : end_date borne la génération (bail terminé dans le passé)", () => {
    // Bail jan->mars, today en juin : seules jan/fév/mars dues, rien après.
    const r = computeRentDuePeriods("2026-01-05", 5, "2026-03-31", "2026-06-20")
    expect(r.map((p) => p.period_start)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ])
  })

  it("cas 4 bis : pas d'end_date -> génère jusqu'au mois courant", () => {
    const r = computeRentDuePeriods("2026-01-05", 5, null, "2026-03-20")
    expect(r.map((p) => p.period_start)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ])
  })

  it("bail commençant dans le futur -> génère au moins son premier mois", () => {
    const r = computeRentDuePeriods("2026-09-01", 5, null, "2026-06-20")
    expect(r.map((p) => p.period_start)).toEqual(["2026-09-01"])
  })

  it("due_date > end_date autorisé si due_date reste dans le mois couvert", () => {
    // Bail finit le 3, due_day 5 -> dernier mois dû, due_date = 5 (> end_date).
    const r = computeRentDuePeriods("2026-01-05", 5, "2026-03-03", "2026-06-20")
    const march = r.find((p) => p.period_start === "2026-03-01")
    expect(march).toBeDefined()
    expect(march!.due_date).toBe("2026-03-05") // > end_date 2026-03-03
    // invariant : due_date dans [period_start, period_end]
    expect(march!.due_date >= march!.period_start).toBe(true)
    expect(march!.due_date <= march!.period_end).toBe(true)
  })

  it("invariant global : due_date toujours dans [period_start, period_end]", () => {
    const r = computeRentDuePeriods("2026-01-15", 31, "2026-12-31", "2026-12-31")
    for (const p of r) {
      expect(p.due_date >= p.period_start).toBe(true)
      expect(p.due_date <= p.period_end).toBe(true)
    }
  })
})
