import { describe, expect, it } from "vitest"
import { formatFcfa } from "@/lib/format"
import { buildStatementMessage, buildStatementWaLink } from "../whatsapp"

const BASE = {
  ownerName: "Mme Hounkpatin",
  month: "2026-08",
  collected: 350_000,
  fee: 28_000,
  net: 322_000,
}

function decoded(link: string): string {
  return new URL(link).searchParams.get("text") ?? ""
}

describe("annonce du relevé au mandant", () => {
  it("annonce le mois, l'encaissé, les honoraires et le net", () => {
    const message = buildStatementMessage(BASE)

    expect(message).toContain("Bonjour Mme Hounkpatin,")
    expect(message).toContain("août 2026")
    expect(message).toContain(formatFcfa(350_000))
    expect(message).toContain(formatFcfa(28_000))
    expect(message).toContain(formatFcfa(322_000))
  })

  it("mois sans encaissement : on le dit, sans montants", () => {
    const message = buildStatementMessage({ ...BASE, collected: 0, fee: 0, net: 0 })

    expect(message).toContain("aucun encaissement")
    expect(message).not.toContain("à vous reverser")
  })

  it("lien wa.me vers le numéro du mandant", () => {
    const link = buildStatementWaLink({ ...BASE, phone: "+229 90 01 02 03" })!

    expect(link.startsWith("https://wa.me/22990010203?text=")).toBe(true)
    expect(decoded(link)).toBe(buildStatementMessage(BASE))
  })

  it("mandant sans numéro : pas de lien", () => {
    expect(buildStatementWaLink({ ...BASE, phone: null })).toBeNull()
    expect(buildStatementWaLink({ ...BASE, phone: "sans chiffre" })).toBeNull()
  })
})
