import { describe, expect, it } from "vitest"
import { validateBailForm, type BailFormInput, type BailRowInput } from "../validation"

function row(overrides: Partial<BailRowInput> = {}): BailRowInput {
  return {
    occupied: "1",
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

function base(overrides: Partial<BailFormInput> = {}): BailFormInput {
  return {
    propertyMode: "new",
    propertyId: "",
    propertyName: "Résidence Calavi",
    propertyCity: "Calavi",
    rows: [row()],
    ...overrides,
  }
}

describe("validateBailForm", () => {
  it("crée un lieu inline (mode new) avec l'occupant", () => {
    const r = validateBailForm(base())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.property).toEqual({ name: "Résidence Calavi", city: "Calavi" })
      expect(r.rows).toHaveLength(1)
      expect(r.rows[0].first_name).toBe("Aïcha")
      expect(r.rows[0].unit_type).toBe("room")
      expect(r.rows[0].monthly_rent_amount).toBe("50000")
      expect(r.rows[0].due_day).toBe("5")
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

  it("mode new sans nom de lieu → erreur sans ligne fautive", () => {
    const r = validateBailForm(base({ propertyName: "" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rowIndex).toBeNull()
  })

  it("mode existing sans id → erreur", () => {
    expect(validateBailForm(base({ propertyMode: "existing", propertyId: "" })).ok).toBe(false)
  })

  it("ligne occupée : prénom manquant → erreur", () => {
    expect(validateBailForm(base({ rows: [row({ firstName: "" })] })).ok).toBe(false)
  })

  it("téléphone Bénin invalide → erreur", () => {
    expect(validateBailForm(base({ rows: [row({ phone: "abc" })] })).ok).toBe(false)
  })

  it("loyer non positif → erreur", () => {
    expect(validateBailForm(base({ rows: [row({ monthlyRentAmount: "0" })] })).ok).toBe(false)
  })

  // ── #166 : saisie en lot + logement encore libre (Journeys 4-5) ──────────

  it("ligne libre : logement seul, sans occupant ni bail", () => {
    const r = validateBailForm(
      base({ rows: [row({ occupied: "0", firstName: "", lastName: "", phone: "", monthlyRentAmount: "", dueDay: "", startDate: "" })] }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.rows[0]).toEqual({ unit_name: "Chambre 1", unit_type: "room" })
      expect(r.rows[0].first_name).toBeUndefined()
    }
  })

  it("ligne libre : le nom du logement reste requis", () => {
    const r = validateBailForm(base({ rows: [row({ occupied: "0", unitName: "" })] }))
    expect(r.ok).toBe(false)
  })

  it("lot mixte : 2 occupées + 1 libre → 3 lignes RPC", () => {
    const r = validateBailForm(
      base({
        rows: [
          row({ unitName: "Chambre 1" }),
          row({ unitName: "Chambre 2", firstName: "Bio", lastName: "Sanni" }),
          row({ occupied: "0", unitName: "Boutique", unitType: "shop", firstName: "", phone: "" }),
        ],
      }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.rows).toHaveLength(3)
      expect(r.rows[0].first_name).toBe("Aïcha")
      expect(r.rows[1].first_name).toBe("Bio")
      expect(r.rows[2]).toEqual({ unit_name: "Boutique", unit_type: "shop" })
    }
  })

  it("lot : l'erreur porte le numéro ET l'index de la ligne fautive", () => {
    const r = validateBailForm(
      base({
        rows: [row({ unitName: "Chambre 1" }), row({ unitName: "Chambre 2", phone: "abc" })],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.rowIndex).toBe(1)
      expect(r.formError).toContain("Ligne 2 :")
    }
  })

  it("mono-ligne : pas de préfixe « Ligne N » dans le message", () => {
    const r = validateBailForm(base({ rows: [row({ phone: "abc" })] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.formError).not.toContain("Ligne")
  })

  it("aucune ligne → erreur", () => {
    const r = validateBailForm(base({ rows: [] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.formError).toContain("au moins un logement")
  })
})
