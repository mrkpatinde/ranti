import { describe, expect, it } from "vitest"
import { parseDelimited } from "../csv"
import { autoMapColumns, buildImportRows } from "../mapping"
import { buildPortfolioSummary, summaryLine } from "../summary"

// La synthèse se construit sur les lignes prêtes pour l'import, comme à
// l'écran : mêmes colonnes reconnues, mêmes normalisations.
function rowsFrom(text: string) {
  const table = parseDelimited(text)
  return buildImportRows(table, autoMapColumns(table.headers))
}

const PORTFOLIO = [
  "Propriétaire;Immeuble;Lot;Locataire;Téléphone;Loyer",
  "Awa Diallo;Fifadji;A1;Aïcha Kossou;0190000000;125000",
  "Awa Diallo;Fifadji;A2;;;80000",
  "Awa Diallo;Zogbo;B1;Jean Hounsou;0196000000;60000",
  "Codjo Ahouansou;Ganhi;C1;Ana Silva;0197000000;100000",
].join("\n")

describe("buildPortfolioSummary", () => {
  it("compte propriétaires, immeubles, lots, locataires et vacants", () => {
    const summary = buildPortfolioSummary(rowsFrom(PORTFOLIO))

    expect(summary.ownerCount).toBe(2)
    expect(summary.propertyCount).toBe(3)
    expect(summary.unitCount).toBe(4)
    expect(summary.tenantCount).toBe(3)
    expect(summary.vacantCount).toBe(1)
  })

  it("groupe propriétaire → immeuble → lots, dans l'ordre du fichier", () => {
    const summary = buildPortfolioSummary(rowsFrom(PORTFOLIO))

    expect(summary.owners.map((owner) => owner.name)).toEqual(["Awa Diallo", "Codjo Ahouansou"])
    expect(summary.owners[0].properties.map((property) => property.name)).toEqual([
      "Fifadji",
      "Zogbo",
    ])
    expect(summary.owners[0].properties[0].units.map((unit) => unit.name)).toEqual(["A1", "A2"])

    const first = summary.owners[0].properties[0].units[0]
    expect(first.line).toBe(1)
    expect(first.tenantName).toBe("Aïcha Kossou")
    expect(first.rent).toBe(125000)

    // Le lot A2 est vacant : pas de locataire, mais son loyer reste lisible.
    const vacant = summary.owners[0].properties[0].units[1]
    expect(vacant.tenantName).toBeNull()
    expect(vacant.rent).toBe(80000)
  })

  it("regroupe le même propriétaire malgré la casse et les accents", () => {
    const summary = buildPortfolioSummary(
      rowsFrom(
        [
          "Propriétaire;Immeuble;Lot",
          "Awa Diallo;Fifadji;A1",
          "AWA DIALLO;Fifadji;A2",
        ].join("\n"),
      ),
    )

    expect(summary.ownerCount).toBe(1)
    expect(summary.owners).toHaveLength(1)
    expect(summary.owners[0].name).toBe("Awa Diallo")
  })

  it("un fichier sans propriétaire garde un seul groupe, non compté", () => {
    const summary = buildPortfolioSummary(
      rowsFrom("Immeuble;Lot\nFifadji;A1\nFifadji;A2"),
    )

    expect(summary.ownerCount).toBe(0)
    expect(summary.owners).toHaveLength(1)
    expect(summary.owners[0].name).toBe("")
    expect(summary.propertyCount).toBe(1)
    expect(summary.unitCount).toBe(2)
  })

  it("un locataire connu seulement par son téléphone compte comme occupant", () => {
    const summary = buildPortfolioSummary(
      rowsFrom("Immeuble;Lot;Locataire;Téléphone\nFifadji;A1;;0190000000"),
    )

    expect(summary.tenantCount).toBe(1)
    expect(summary.vacantCount).toBe(0)
    expect(summary.owners[0].properties[0].units[0].tenantName).toBe("+2290190000000")
  })

  it("un loyer illisible reste absent plutôt qu'inventé", () => {
    const summary = buildPortfolioSummary(
      rowsFrom("Immeuble;Lot;Loyer\nFifadji;A1;à discuter"),
    )

    expect(summary.owners[0].properties[0].units[0].rent).toBeNull()
  })
})

describe("summaryLine", () => {
  it("écrit la synthèse humaine, singuliers et pluriels compris", () => {
    const summary = buildPortfolioSummary(rowsFrom(PORTFOLIO))

    expect(summaryLine(summary)).toBe(
      "2 propriétaires · 3 immeubles · 4 lots · 3 locataires · 1 lot vacant",
    )
  })

  it("omet les segments absents : pas de « 0 propriétaire »", () => {
    const summary = buildPortfolioSummary(
      rowsFrom("Immeuble;Lot;Locataire;Téléphone\nFifadji;A1;Aïcha Kossou;0190000000"),
    )

    expect(summaryLine(summary)).toBe("1 immeuble · 1 lot · 1 locataire")
  })
})
