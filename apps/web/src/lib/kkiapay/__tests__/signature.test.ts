import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifyKkiapaySignature } from "../signature"

const SECRET = "test-secret"

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex")
}

describe("verifyKkiapaySignature", () => {
  const body = JSON.stringify({ transactionId: "KKP-001", amount: 60000 })

  it("accepte une signature HMAC-SHA256 valide", () => {
    expect(verifyKkiapaySignature(body, sign(body), SECRET)).toBe(true)
  })

  it("accepte la signature en majuscules (normalisation hex)", () => {
    expect(verifyKkiapaySignature(body, sign(body).toUpperCase(), SECRET)).toBe(true)
  })

  it("refuse une signature invalide", () => {
    expect(verifyKkiapaySignature(body, sign("autre corps"), SECRET)).toBe(false)
  })

  it("refuse un corps altéré", () => {
    expect(verifyKkiapaySignature(body + "x", sign(body), SECRET)).toBe(false)
  })

  it("refuse en-tête absent ou secret vide", () => {
    expect(verifyKkiapaySignature(body, null, SECRET)).toBe(false)
    expect(verifyKkiapaySignature(body, sign(body), "")).toBe(false)
  })

  it("refuse une signature de mauvaise longueur", () => {
    expect(verifyKkiapaySignature(body, "abcd", SECRET)).toBe(false)
  })

  it("refuse un en-tête non-hex de la bonne longueur (sans lever)", () => {
    // Buffer.from(..., "hex") s'arrête au premier octet invalide → buffer plus
    // court → rejet par comparaison de longueur, jamais d'exception.
    expect(verifyKkiapaySignature(body, "z".repeat(64), SECRET)).toBe(false)
    expect(verifyKkiapaySignature(body, sign(body).slice(0, 63) + "g", SECRET)).toBe(false)
  })

  it("tolère les espaces autour de l'en-tête (trim)", () => {
    expect(verifyKkiapaySignature(body, `  ${sign(body)}  `, SECRET)).toBe(true)
  })
})
