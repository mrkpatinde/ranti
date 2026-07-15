import { describe, expect, it } from "vitest"
import { validateBailForm, type BailFormInput } from "../validation"

function base(overrides: Partial<BailFormInput> = {}): BailFormInput {
  return {
    propertyMode: "new",
    propertyId: "",
    propertyName: "Résidence Calavi",
    propertyCity: "Calavi",
    unitName: "Chambre 1",
    unitType: "room",
    firstName: "Aïcha",
    lastName: "Kossou",
    phone: "01 90 00 00 00",
    email: "",
    monthlyRentAmount: "50000",
    dueDay: "5",
    startDate: "2026-01-01",
    ...overrides,
  }
}

describe("validateBailForm", () => {
  it("crée un lieu inline (mode new) avec l'occupant", () => {
    const r = validateBailForm(base())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.property).toEqual({ name: "Résidence Calavi", city: "Calavi" })
      expect(r.row.first_name).toBe("Aïcha")
      expect(r.row.unit_type).toBe("room")
      expect(r.row.monthly_rent_amount).toBe("50000")
      expect(r.row.due_day).toBe("5")
    }
  })

  it("nom de lieu seul (sans ville) → payload {name}", () => {
    const r = validateBailForm(base({ propertyCity: "" }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.property).toEqual({ name: "Résidence Calavi" })
  })

  it("pioche un lieu existant (mode existing)", () => {
    const r = validateBailForm(base({ propertyMode: "existing", propertyId: "prop-123" }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.property).toEqual({ id: "prop-123" })
  })

  it("mode new sans nom de lieu → erreur", () => {
    expect(validateBailForm(base({ propertyName: "" })).ok).toBe(false)
  })

  it("mode existing sans id → erreur", () => {
    expect(validateBailForm(base({ propertyMode: "existing", propertyId: "" })).ok).toBe(false)
  })

  it("occupant toujours requis (prénom manquant)", () => {
    expect(validateBailForm(base({ firstName: "" })).ok).toBe(false)
  })

  it("téléphone Bénin invalide → erreur", () => {
    expect(validateBailForm(base({ phone: "abc" })).ok).toBe(false)
  })

  it("loyer non positif → erreur", () => {
    expect(validateBailForm(base({ monthlyRentAmount: "0" })).ok).toBe(false)
  })
})
