// Garde-fou de rendu : une propriété de style invalide ne casse pas la
// compilation, elle casse la route PDF à l'exécution. Le relevé est un
// document remis au mandant — il doit se rendre, lignes ou pas.
import { describe, expect, it } from "vitest"
import { renderToBuffer } from "@react-pdf/renderer"
import { OwnerStatementPdf } from "../pdf"
import type { OwnerStatement } from "../types"

const statement: OwnerStatement = {
  owner: { id: "o1", display_name: "Mme Hounkpatin", phone: "+22990010203", email: "a@b.co", fee_rate_bp: 800 },
  agency: { name: "Agence Zogbo", company_name: "Agence Zogbo", phone: "+22997000000", address: "Rue 12", city: "Cotonou" },
  period: { month: "2026-08", from: "2026-08-01", to: "2026-08-31" },
  lines: [
    { unit_id: "u1", property_name: "Résidence Zogbo", unit_name: "Lot A", tenant_name: "Awa Diop", lease_id: "l1", expected: 120000, collected: 120000, fee: 9600, net: 110400, fee_rate_bp: 800 },
    { unit_id: "u2", property_name: "Résidence Zogbo", unit_name: "Lot B", tenant_name: null, lease_id: null, expected: 0, collected: 0, fee: 0, net: 0, fee_rate_bp: 800 },
    { unit_id: "u3", property_name: "Calavi", unit_name: "Studio 2", tenant_name: "Koffi", lease_id: "l3", expected: 80000, collected: 40000, fee: 3200, net: 36800, fee_rate_bp: 800 },
  ],
  totals: { expected: 200000, collected: 160000, fee: 12800, net_due_to_owner: 147200, outstanding: 40000 },
  generated_at: "2026-08-09T10:00:00.000Z",
}

describe("PDF du relevé", () => {
  it("se rend sans erreur", async () => {
    const buffer = await renderToBuffer(OwnerStatementPdf({ statement }))
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
  }, 30000)

  it("se rend sans lignes", async () => {
    const buffer = await renderToBuffer(OwnerStatementPdf({ statement: { ...statement, lines: [] } }))
    expect(buffer.length).toBeGreaterThan(1000)
  }, 30000)
})
