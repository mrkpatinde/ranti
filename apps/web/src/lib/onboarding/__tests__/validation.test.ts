import { describe, it, expect } from "vitest"
import {
  validateBulkOnboarding,
  type BulkRawRow,
  type BulkShared,
} from "../validation"

const shared: BulkShared = {
  propertyId: "33333333-3333-3333-3333-333333333333",
  unitType: "room",
  dueDay: "5",
}

function row(partial: Partial<BulkRawRow>): BulkRawRow {
  return {
    unitName: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    monthlyRentAmount: "",
    startDate: "",
    ...partial,
  }
}

const occupied = row({
  unitName: "Chambre 1",
  firstName: "Aline",
  lastName: "Koffi",
  phone: "+2290123456789",
  monthlyRentAmount: "50000",
  startDate: "2026-01-05",
})

describe("validateBulkOnboarding", () => {
  it("accepts an occupied row and a vacant row", () => {
    const result = validateBulkOnboarding(shared, [
      occupied,
      row({ unitName: "Chambre 2" }),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(2)
    // occupied -> full tenant block, due_day inherited from shared
    expect(result.rows[0]).toMatchObject({
      unit_name: "Chambre 1",
      unit_type: "room",
      first_name: "Aline",
      last_name: "Koffi",
      phone: "+2290123456789",
      monthly_rent_amount: "50000",
      due_day: "5",
      start_date: "2026-01-05",
    })
    // vacant -> unit only, no tenant/lease fields
    expect(result.rows[1]).toEqual({ unit_name: "Chambre 2", unit_type: "room" })
  })

  it("ignores fully empty trailing rows", () => {
    const result = validateBulkOnboarding(shared, [
      row({ unitName: "Chambre 1" }),
      row({}),
      row({}),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(1)
  })

  it("requires a unit name", () => {
    const result = validateBulkOnboarding(shared, [row({ firstName: "Aline" })])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.rowErrors.some((e) => e.field === "unitName" && e.row === 1)).toBe(true)
  })

  it("treats the tenant block as all-or-nothing", () => {
    const result = validateBulkOnboarding(shared, [
      row({ unitName: "Chambre 1", phone: "+2290123456789" }),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    const fields = result.rowErrors.map((e) => e.field)
    expect(fields).toContain("firstName")
    expect(fields).toContain("lastName")
    expect(fields).toContain("monthlyRentAmount")
    expect(fields).toContain("startDate")
  })

  it("rejects a non-Benin phone", () => {
    const result = validateBulkOnboarding(shared, [
      row({
        unitName: "Chambre 1",
        firstName: "Aline",
        lastName: "Koffi",
        phone: "+33612345678",
        monthlyRentAmount: "50000",
        startDate: "2026-01-05",
      }),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.rowErrors.some((e) => e.field === "phone")).toBe(true)
  })

  it("rejects an invalid rent amount", () => {
    const result = validateBulkOnboarding(shared, [
      row({
        unitName: "Chambre 1",
        firstName: "Aline",
        lastName: "Koffi",
        phone: "+2290123456789",
        monthlyRentAmount: "0",
        startDate: "2026-01-05",
      }),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.rowErrors.some((e) => e.field === "monthlyRentAmount")).toBe(true)
  })

  it("rejects an invalid shared due day with a form error", () => {
    const result = validateBulkOnboarding({ ...shared, dueDay: "40" }, [
      row({ unitName: "Chambre 1" }),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.formError).toBeTruthy()
  })

  it("requires at least one logement", () => {
    const result = validateBulkOnboarding(shared, [row({}), row({})])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.formError).toContain("au moins un logement")
  })

  it("rejects a missing property", () => {
    const result = validateBulkOnboarding({ ...shared, propertyId: "" }, [
      row({ unitName: "Chambre 1" }),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.formError).toBeTruthy()
  })
})
