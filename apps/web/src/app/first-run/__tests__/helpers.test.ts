import { describe, expect, it } from "vitest"
import {
  fcfa, mapBailError, mapCollectionError, monthLabel, parseStrictAmount, validRequestId,
} from "../helpers"

describe("monthLabel", () => {
  it("formate AAAA-MM-JJ sans décalage de fuseau, mois accentué", () => {
    expect(monthLabel("2026-07-01")).toBe("juillet 2026")
    expect(monthLabel("2026-02-15")).toBe("février 2026")
    expect(monthLabel("2026-08-01")).toBe("août 2026")
    expect(monthLabel("2026-12-31")).toBe("décembre 2026")
  })
  it("renvoie null pour null, format invalide ou mois hors bornes", () => {
    expect(monthLabel(null)).toBeNull()
    expect(monthLabel("07/2026")).toBeNull()
    expect(monthLabel("2026-13-01")).toBeNull()
    expect(monthLabel("2026-00-01")).toBeNull()
  })
})

describe("mapCollectionError", () => {
  it("mappe chaque code métier connu", () => {
    expect(mapCollectionError("DUPLICATE_PAYMENT: x")).toMatch(/deja ete enregistre/)
    expect(mapCollectionError("allocations_exceed_amount")).toMatch(/depasse le montant recu/)
    expect(mapCollectionError("allocation_exceeds_due")).toMatch(/reste du/)
    expect(mapCollectionError("amount_invalid")).toMatch(/montant valide/)
    expect(mapCollectionError("method_invalid")).toMatch(/Methode/)
    expect(mapCollectionError("due_unit_mismatch")).toMatch(/echeance/)
  })
  it("retombe sur le message générique", () => {
    expect(mapCollectionError("boom")).toBe("Encaissement impossible. Reessayez.")
    expect(mapCollectionError("")).toBe("Encaissement impossible. Reessayez.")
  })
})

describe("mapBailError", () => {
  it("mappe les SQLSTATE de bulk_onboard_portfolio", () => {
    expect(mapBailError({ code: "23505" })).toMatch(/porte deja ce nom/)
    expect(mapBailError({ code: "23P01" })).toMatch(/bail actif/)
    expect(mapBailError({ code: "P0002" })).toMatch(/introuvable/)
    expect(mapBailError({ code: "autre" })).toMatch(/Verifiez les champs/)
  })
})

describe("parseStrictAmount", () => {
  it("accepte les chiffres avec espaces de groupement", () => {
    expect(parseStrictAmount("100 000")).toBe(100000)
    expect(parseStrictAmount("5000")).toBe(5000)
  })
  it("rejette tout ce qui n'est pas purement numérique (parseInt accepterait 100abc)", () => {
    expect(parseStrictAmount("100abc")).toBeNaN()
    expect(parseStrictAmount("1e9")).toBeNaN()
    expect(parseStrictAmount("-50")).toBeNaN()
    expect(parseStrictAmount("12.5")).toBeNaN()
    expect(parseStrictAmount("")).toBeNaN()
  })
})

describe("validRequestId", () => {
  it("accepte un UUID, rejette le reste", () => {
    expect(validRequestId("cc000000-0000-4000-8000-000000000001")).toBe("cc000000-0000-4000-8000-000000000001")
    expect(validRequestId(" cc000000-0000-4000-8000-000000000001 ")).toBe("cc000000-0000-4000-8000-000000000001")
    expect(validRequestId("nope")).toBeNull()
    expect(validRequestId("")).toBeNull()
  })
})

describe("fcfa", () => {
  it("XOF passe par formatFcfa : s\u00e9parateur U+00A0, jamais U+202F (bug PDF)", () => {
    const label = fcfa(100000, "XOF")
    expect(label).toBe("100\u00a0000\u00a0FCFA")
    expect(label).not.toContain("\u202f")
  })
  it("autre devise : nombre group\u00e9 U+00A0 + code tel quel", () => {
    expect(fcfa(100000, "GHS")).toBe("100\u00a0000 GHS")
  })
})
