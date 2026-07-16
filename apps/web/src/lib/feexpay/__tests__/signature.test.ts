import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifyFeexpaySignature } from "../signature"

const SECRET = "test-secret"

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex")
}

describe("verifyFeexpaySignature", () => {
  const body = JSON.stringify({ reference: "FXP-001", amount: 60000 })

  it("accepte une signature HMAC-SHA256 valide", () => {
    expect(verifyFeexpaySignature(body, sign(body), SECRET)).toBe(true)
  })

  it("accepte la signature en majuscules (normalisation hex)", () => {
    expect(verifyFeexpaySignature(body, sign(body).toUpperCase(), SECRET)).toBe(true)
  })

  it("refuse une signature invalide", () => {
    expect(verifyFeexpaySignature(body, sign("autre corps"), SECRET)).toBe(false)
  })

  it("refuse un corps altéré", () => {
    expect(verifyFeexpaySignature(body + "x", sign(body), SECRET)).toBe(false)
  })

  it("refuse en-tête absent ou secret vide", () => {
    expect(verifyFeexpaySignature(body, null, SECRET)).toBe(false)
    expect(verifyFeexpaySignature(body, sign(body), "")).toBe(false)
  })

  it("refuse une signature de mauvaise longueur", () => {
    expect(verifyFeexpaySignature(body, "abcd", SECRET)).toBe(false)
  })

  it("refuse un en-tête non-hex de la bonne longueur (sans lever)", () => {
    expect(verifyFeexpaySignature(body, "z".repeat(64), SECRET)).toBe(false)
    expect(verifyFeexpaySignature(body, sign(body).slice(0, 63) + "g", SECRET)).toBe(false)
  })

  it("tolère les espaces autour de l'en-tête (trim)", () => {
    expect(verifyFeexpaySignature(body, `  ${sign(body)}  `, SECRET)).toBe(true)
  })
})
