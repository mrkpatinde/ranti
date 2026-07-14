import { describe, expect, it } from "vitest"
import { buildTenantPaymentWaLink } from "../whatsapp"

function decodedText(link: string): string {
  const text = new URL(link).searchParams.get("text") ?? ""
  return text
}

describe("buildTenantPaymentWaLink", () => {
  it("porte le lien /recu/[token] pour confirmer et télécharger le PDF", () => {
    const link = buildTenantPaymentWaLink({
      phone: "+229 01 97 14 74 02",
      tenantName: "Awa Koffi",
      amount: 60000,
      receiptUrl: "https://www.monranti.com/recu/d7d0bf9a-5945-49df-ab09-7317d2ce5b51",
    })

    expect(link).not.toBeNull()
    expect(link!.startsWith("https://wa.me/2290197147402?text=")).toBe(true)

    const text = decodedText(link!)
    expect(text).toContain("Awa Koffi")
    expect(text).toContain("https://www.monranti.com/recu/d7d0bf9a-5945-49df-ab09-7317d2ce5b51")
    expect(text).toContain("PDF")
  })

  it("reste valide sans reçu émis (aucun lien mort dans le message)", () => {
    const link = buildTenantPaymentWaLink({
      phone: "+22901971474 02",
      tenantName: null,
      amount: 25000,
      receiptUrl: null,
    })

    const text = decodedText(link!)
    expect(text).not.toContain("http")
    expect(text).toContain("Bonjour,")
  })

  it("null si le numéro est inexploitable", () => {
    expect(buildTenantPaymentWaLink({ phone: "", tenantName: "X", amount: 1000 })).toBeNull()
  })
})
