import { describe, expect, it } from "vitest"
import { formatFcfa } from "@/lib/format"
import { buildReminderWaLink } from "../whatsapp"

const BASE = {
  phone: "+22990010203",
  tenantName: "Awa",
  amount: 50000,
  dueDate: "2026-07-25",
  late: false,
}

function decoded(link: string): string {
  const text = new URL(link).searchParams.get("text") ?? ""
  return text
}

describe("buildReminderWaLink", () => {
  it("rappel avant échéance : wa.me vers le numéro, message daté", () => {
    const link = buildReminderWaLink(BASE)!
    expect(link.startsWith("https://wa.me/22990010203?text=")).toBe(true)
    const msg = decoded(link)
    expect(msg).toContain("Bonjour Awa,")
    expect(msg).toContain(formatFcfa(50000))
    expect(msg).toContain("arrive à échéance le 25 juillet 2026")
  })

  it("relance de retard : message « en retard » avec le mois", () => {
    const msg = decoded(buildReminderWaLink({ ...BASE, late: true })!)
    expect(msg).toContain("est en retard")
    expect(msg).toContain("(juillet 2026)")
    expect(msg).toContain("régulariser")
  })

  it("inclut le lien de confirmation quand fourni", () => {
    const msg = decoded(
      buildReminderWaLink({ ...BASE, confirmUrl: "https://www.monranti.com/confirmer/abc" })!,
    )
    expect(msg).toContain("confirmer votre paiement ici : https://www.monranti.com/confirmer/abc")
  })

  it("sans nom : salutation neutre", () => {
    const msg = decoded(buildReminderWaLink({ ...BASE, tenantName: null })!)
    expect(msg.startsWith("Bonjour, ")).toBe(true)
  })

  it("numéro inexploitable → null", () => {
    expect(buildReminderWaLink({ ...BASE, phone: "" })).toBeNull()
    expect(buildReminderWaLink({ ...BASE, phone: "+++" })).toBeNull()
  })
})
