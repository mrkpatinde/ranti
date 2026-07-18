import { describe, expect, it } from "vitest"
import { receiptClause } from "@/lib/receipts/clause"

// Clause notariale partagée par la page locataire (/recu), le PDF et la
// modale FirstRun : la formulation doit rester identique sur les trois
// surfaces et s'adapter au kind (quittance = solde, reçu = paiement partiel).
describe("receiptClause", () => {
  const base = { landlordName: "Florentine Dossou", tenantName: "Adjovi Hounkpatin", amount: 100000 }

  it("quittance : solde de la période, montant en chiffres ET en toutes lettres", () => {
    const c = receiptClause({ ...base, kind: "quittance" })
    expect(c).toContain("Je soussigné(e) Florentine Dossou, propriétaire")
    expect(c).toContain("reconnais avoir reçu de Adjovi Hounkpatin")
    expect(c).toContain("(cent mille francs CFA)")
    expect(c).toContain("dont quittance pour solde de ladite période.")
    expect(c).not.toContain("paiement partiel")
  })

  it("reçu : paiement partiel, jamais « quittance pour solde »", () => {
    const c = receiptClause({ ...base, kind: "receipt" })
    expect(c).toContain("à titre de paiement partiel du loyer de ladite période.")
    expect(c).not.toContain("dont quittance pour solde")
  })

  it("aucun tiret cadratin (règle handoff §2)", () => {
    expect(receiptClause({ ...base, kind: "quittance" })).not.toContain("—")
    expect(receiptClause({ ...base, kind: "receipt" })).not.toContain("—")
  })
})
