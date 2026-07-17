import { describe, expect, it } from "vitest"
import { buildChargeWaLink } from "../whatsapp"

describe("buildChargeWaLink (notification de charge préparée, pas envoyée)", () => {
  it("construit le lien wa.me avec libellé, montant FCFA et lien d'action", () => {
    const link = buildChargeWaLink({
      phone: "+229 01 00 00 00 91",
      tenantName: "Ayo Charge",
      label: "Réparation serrure",
      amount: 5000,
      actionUrl: "https://www.monranti.com/transaction/abc",
    })
    expect(link).toMatch(/^https:\/\/wa\.me\/2290100000091\?text=/)
    const text = decodeURIComponent(link!.split("text=")[1])
    expect(text).toContain("Bonjour Ayo Charge")
    expect(text).toContain("Réparation serrure")
    expect(text).toContain("5\u00a0000\u00a0FCFA")
    expect(text).toContain("https://www.monranti.com/transaction/abc")
  })

  it("numéro inexploitable → null ; nom absent → salutation neutre", () => {
    expect(
      buildChargeWaLink({ phone: "—", tenantName: null, label: "x", amount: 1, actionUrl: "u" }),
    ).toBeNull()
    const link = buildChargeWaLink({
      phone: "+22990000000",
      tenantName: null,
      label: "Frais",
      amount: 1000,
      actionUrl: "u",
    })
    expect(decodeURIComponent(link!)).toContain("Bonjour, ")
  })
})
