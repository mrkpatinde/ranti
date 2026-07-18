import { describe, expect, it } from "vitest"
import { amountInWordsFcfa, integerToFrenchWords } from "@/lib/amount-words"

describe("integerToFrenchWords", () => {
  const cases: [number, string][] = [
    [0, "zéro"],
    [1, "un"],
    [16, "seize"],
    [17, "dix-sept"],
    [20, "vingt"],
    [21, "vingt et un"],
    [22, "vingt-deux"],
    [70, "soixante-dix"],
    [71, "soixante et onze"],
    [72, "soixante-douze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [90, "quatre-vingt-dix"],
    [91, "quatre-vingt-onze"],
    [100, "cent"],
    [101, "cent un"],
    [180, "cent quatre-vingts"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [1000, "mille"],
    [2000, "deux mille"],
    [5000, "cinq mille"],
    [21000, "vingt et un mille"],
    [80000, "quatre-vingt mille"], // « quatre-vingt » sans s devant mille
    [100000, "cent mille"],
    [200000, "deux cent mille"], // « cent » sans s devant mille
    [320000, "trois cent vingt mille"],
    [1_000_000, "un million"],
    [2_000_000, "deux millions"],
    [1_500_000, "un million cinq cent mille"],
    [200_000_000, "deux cents millions"], // « cent » avec s devant le nom « millions »
  ]
  it.each(cases)("%i -> %s", (n, expected) => {
    expect(integerToFrenchWords(n)).toBe(expected)
  })
})

describe("amountInWordsFcfa", () => {
  it("accorde franc/francs et ajoute CFA", () => {
    expect(amountInWordsFcfa(0)).toBe("zéro franc CFA")
    expect(amountInWordsFcfa(1)).toBe("un franc CFA")
    expect(amountInWordsFcfa(100000)).toBe("cent mille francs CFA")
  })
  it("tronque les décimales et borne à zéro", () => {
    expect(amountInWordsFcfa(100000.99)).toBe("cent mille francs CFA")
    expect(amountInWordsFcfa(-50)).toBe("zéro franc CFA")
  })
})
