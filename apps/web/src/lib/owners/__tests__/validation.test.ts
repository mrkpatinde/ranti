import { describe, expect, it } from "vitest"
import { feeRateInputValue, formatFeeRate, parseFeePercent } from "../validation"

describe("parseFeePercent", () => {
  it("convertit un pourcentage à virgule en points de base", () => {
    expect(parseFeePercent("8,5")).toBe(850)
    expect(parseFeePercent("8.5")).toBe(850)
    expect(parseFeePercent("8")).toBe(800)
    expect(parseFeePercent("10 %")).toBe(1000)
  })

  it("traite une saisie vide comme aucun honoraire", () => {
    expect(parseFeePercent("")).toBe(0)
    expect(parseFeePercent("   ")).toBe(0)
  })

  it("refuse une saisie hors bornes ou illisible", () => {
    expect(parseFeePercent("101")).toBeNull()
    expect(parseFeePercent("-2")).toBeNull()
    expect(parseFeePercent("huit")).toBeNull()
    expect(parseFeePercent(null)).toBeNull()
  })

  it("arrondit à la décimale affichée", () => {
    expect(parseFeePercent("8,55")).toBe(860)
  })
})

describe("affichage du taux", () => {
  it("écrit le taux en pourcentage, jamais en points de base", () => {
    expect(formatFeeRate(850)).toBe("8,5\u00a0%")
    expect(formatFeeRate(800)).toBe("8\u00a0%")
    expect(formatFeeRate(0)).toBe("0\u00a0%")
  })

  it("rend une valeur de formulaire relisible par la saisie", () => {
    expect(parseFeePercent(feeRateInputValue(850))).toBe(850)
    expect(parseFeePercent(feeRateInputValue(1250))).toBe(1250)
  })
})
