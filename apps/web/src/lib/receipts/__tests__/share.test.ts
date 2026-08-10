import { describe, expect, it } from "vitest"
import { receiptIssuerRegistration, registrationLine } from "../issuer"
import { kindLabels } from "../labels"
import { buildReceiptShareMessage } from "../share"

// Vocabulaire (retour fondateur 2026-08-10, ADR-027) : « quittance de loyer »
// pour le loyer intégralement payé, « reçu » réservé au paiement partiel.
// Jamais « reçu de loyer », ni le doublon « reçu de loyer (quittance) ».

const URL = "https://www.monranti.com/recu/d7d0bf9a-5945-49df-ab09-7317d2ce5b51"

describe("kindLabels", () => {
  it("nomme le document selon son kind, jamais « reçu de loyer »", () => {
    expect(kindLabels.quittance).toBe("Quittance de loyer")
    expect(kindLabels.receipt).toBe("Reçu de paiement partiel")
  })
})

describe("buildReceiptShareMessage", () => {
  it("quittance : « quittance de loyer », accord féminin, lien inclus", () => {
    const msg = buildReceiptShareMessage("quittance", URL)

    expect(msg).toBe(
      `Voici votre quittance de loyer. Ouvrez-la et confirmez son exactitude : ${URL}`,
    )
  })

  it("reçu : « reçu de paiement partiel », accord masculin", () => {
    const msg = buildReceiptShareMessage("receipt", URL)

    expect(msg).toBe(
      `Voici votre reçu de paiement partiel. Ouvrez-le et confirmez son exactitude : ${URL}`,
    )
  })

  it("ne dit jamais « reçu de loyer », quel que soit le kind", () => {
    expect(buildReceiptShareMessage("quittance", URL)).not.toContain("reçu de loyer")
    expect(buildReceiptShareMessage("receipt", URL)).not.toContain("reçu de loyer")
  })
})

// Ligne RCCM/IFU sous le nom de l'émetteur (migration 20260810130000) :
// rendue quand présents, absente sinon — les snapshots antérieurs se rendent
// exactement comme avant.
describe("registrationLine", () => {
  it("RCCM et IFU présents : « RCCM … · IFU … »", () => {
    expect(registrationLine("RB/COT/24 B 12345", "1234567890123")).toBe(
      "RCCM RB/COT/24 B 12345 · IFU 1234567890123",
    )
  })

  it("un seul identifiant : pas de séparateur orphelin", () => {
    expect(registrationLine("RB/COT/24 B 12345", null)).toBe("RCCM RB/COT/24 B 12345")
    expect(registrationLine(null, "1234567890123")).toBe("IFU 1234567890123")
  })

  it("rien ou vide : null, la ligne n'est pas rendue", () => {
    expect(registrationLine(null, null)).toBeNull()
    expect(registrationLine("  ", "")).toBeNull()
    expect(registrationLine(undefined, undefined)).toBeNull()
  })

  it("snapshot antérieur sans bloc landlord : null (rétrocompatibilité)", () => {
    expect(receiptIssuerRegistration({})).toBeNull()
    expect(receiptIssuerRegistration(null)).toBeNull()
    expect(
      receiptIssuerRegistration({
        landlord: { first_name: "Awa", last_name: "Diop", company_name: "Horizon" },
      }),
    ).toBeNull()
  })

  it("snapshot avec identifiants : la ligne sort du snapshot figé", () => {
    expect(
      receiptIssuerRegistration({
        landlord: {
          company_name: "Horizon Gestion",
          company_rccm: "RB/COT/24 B 12345",
          company_ifu: "1234567890123",
        },
      }),
    ).toBe("RCCM RB/COT/24 B 12345 · IFU 1234567890123")
  })
})
