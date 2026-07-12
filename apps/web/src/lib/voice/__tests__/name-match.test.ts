import { describe, expect, it } from "vitest"
import { hintMatchesTenant } from "../name-match"

describe("hintMatchesTenant (garde-fou anti-hallucination ADR-012)", () => {
  it("accepte quand le nom entendu recoupe le locataire", () => {
    expect(hintMatchesTenant("Koffi", "Awa Koffi")).toBe(true)
    expect(hintMatchesTenant("awa", "Awa Koffi")).toBe(true)
    // Accents ignorés : « Adé » == « ade ».
    expect(hintMatchesTenant("Adé", "Ade Sossou")).toBe(true)
    // Un seul token qui recoupe suffit (« ade »), l'autre peut différer.
    expect(hintMatchesTenant("ade yao", "Adé Koffi")).toBe(true)
  })

  it("rejette un nom absent, même s'il n'y a qu'un bail", () => {
    expect(hintMatchesTenant("Jean Dupont", "Awa Koffi")).toBe(false)
    expect(hintMatchesTenant("Yao", "Awa Koffi")).toBe(false)
  })

  it("ne réfute rien si aucun nom n'a été entendu", () => {
    expect(hintMatchesTenant("", "Awa Koffi")).toBe(true)
    expect(hintMatchesTenant("  ", "Awa Koffi")).toBe(true)
  })

  it("ignore les tokens trop courts (bruit)", () => {
    // « a » seul ne suffit pas à valider.
    expect(hintMatchesTenant("a", "Awa Koffi")).toBe(true) // 1 char filtré → hint vide → non réfuté
  })
})
