import { describe, expect, it } from "vitest"
import { currentMonth, monthLabel, monthStartIso, resolveMonth, shiftMonth } from "../month"

describe("mois de clôture", () => {
  it("mois en cours au format YYYY-MM", () => {
    expect(currentMonth(new Date(2026, 7, 9))).toBe("2026-08")
    expect(currentMonth(new Date(2026, 0, 1))).toBe("2026-01")
  })

  it("recule et avance d'un mois, y compris au passage d'année", () => {
    expect(shiftMonth("2026-08", -1)).toBe("2026-07")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2025-12", 1)).toBe("2026-01")
    expect(shiftMonth("2026-08", -14)).toBe("2025-06")
  })

  it("libellé français", () => {
    expect(monthLabel("2026-08")).toBe("août 2026")
    expect(monthLabel("2026-01")).toBe("janvier 2026")
  })

  it("premier jour du mois pour les RPC", () => {
    expect(monthStartIso("2026-08")).toBe("2026-08-01")
  })

  it("mois demandé invalide ou futur : repli sur le mois en cours", () => {
    const ref = new Date(2026, 7, 9)
    expect(resolveMonth(undefined, ref)).toBe("2026-08")
    expect(resolveMonth("2026-13", ref)).toBe("2026-08")
    expect(resolveMonth("bidon", ref)).toBe("2026-08")
    expect(resolveMonth("2026-09", ref)).toBe("2026-08")
    expect(resolveMonth("2026-05", ref)).toBe("2026-05")
  })
})
