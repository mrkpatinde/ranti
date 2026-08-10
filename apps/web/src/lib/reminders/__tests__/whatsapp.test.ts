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

  it("sans nom : salutation neutre", () => {
    const msg = decoded(buildReminderWaLink({ ...BASE, tenantName: null })!)
    expect(msg.startsWith("Bonjour, ")).toBe(true)
  })

  it("numéro inexploitable → null", () => {
    expect(buildReminderWaLink({ ...BASE, phone: "" })).toBeNull()
    expect(buildReminderWaLink({ ...BASE, phone: "+++" })).toBeNull()
  })
})

// Numéro marchand dans la relance (retour fondateur 2026-08-10) : quand
// l'alias est renseigné, le message se termine par l'instruction de paiement ;
// sinon, message strictement identique à avant.
describe("instruction de paiement", () => {
  it("avec alias : le message se termine par « Réglez au … (Mobile Money — …). »", () => {
    const msg = decoded(
      buildReminderWaLink({
        ...BASE,
        paymentAlias: "0197000001",
        payeeName: "Horizon Gestion",
      })!,
    )
    expect(msg.endsWith("Réglez au 0197000001 (Mobile Money — Horizon Gestion).")).toBe(true)
  })

  it("alias sans nom : mention Mobile Money seule, jamais de tiret orphelin", () => {
    const msg = decoded(
      buildReminderWaLink({ ...BASE, paymentAlias: "0197000001", payeeName: null })!,
    )
    expect(msg.endsWith("Réglez au 0197000001 (Mobile Money).")).toBe(true)
  })

  it("sans alias (ou vide) : message inchangé", () => {
    const before = decoded(buildReminderWaLink(BASE)!)
    expect(decoded(buildReminderWaLink({ ...BASE, paymentAlias: null })!)).toBe(before)
    expect(
      decoded(buildReminderWaLink({ ...BASE, paymentAlias: "  ", payeeName: "X" })!),
    ).toBe(before)
    expect(before).not.toContain("Réglez au")
  })

  it("s'ajoute aussi à la relance de retard", () => {
    const msg = decoded(
      buildReminderWaLink({
        ...BASE,
        late: true,
        paymentAlias: "0197000001",
        payeeName: "Horizon Gestion",
      })!,
    )
    expect(msg).toContain("est en retard")
    expect(msg.endsWith("Réglez au 0197000001 (Mobile Money — Horizon Gestion).")).toBe(true)
  })
})
