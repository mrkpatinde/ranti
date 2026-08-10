import { describe, expect, it } from "vitest"
import { detectDelimiter, parseDelimited, stripBom } from "../csv"
import { buildTemplateCsv } from "../template"

describe("detectDelimiter", () => {
  it("reconnaît le point-virgule des exports Excel francophones", () => {
    expect(detectDelimiter("Bien;Lot;Loyer\nFifadji;A1;125000")).toBe(";")
  })

  it("reconnaît la virgule", () => {
    expect(detectDelimiter("Bien,Lot,Loyer\nFifadji,A1,125000")).toBe(",")
  })

  it("reconnaît la tabulation d'un collage Excel", () => {
    expect(detectDelimiter("Bien\tLot\tLoyer\nFifadji\tA1\t125000")).toBe("\t")
  })

  it("ignore les séparateurs contenus dans un champ entre guillemets", () => {
    const text = 'Bien,Adresse\n"Fifadji","Rue 12;45; face à la pharmacie"'
    expect(detectDelimiter(text)).toBe(",")
  })

  it("retombe sur la virgule quand aucun séparateur n'est présent", () => {
    expect(detectDelimiter("Bien\nFifadji")).toBe(",")
  })
})

describe("parseDelimited", () => {
  it("lit un CSV à point-virgule", () => {
    const table = parseDelimited("Bien;Lot;Loyer\nFifadji;A1;125000\nFifadji;A2;80000")

    expect(table.delimiter).toBe(";")
    expect(table.headers).toEqual(["Bien", "Lot", "Loyer"])
    expect(table.rows).toEqual([
      ["Fifadji", "A1", "125000"],
      ["Fifadji", "A2", "80000"],
    ])
  })

  it("retire le BOM UTF-8 du premier en-tête", () => {
    const table = parseDelimited("\uFEFFPropriétaire;Bien\nAwa Diallo;Fifadji")

    expect(stripBom("\uFEFFa")).toBe("a")
    expect(table.headers).toEqual(["Propriétaire", "Bien"])
    expect(table.rows).toEqual([["Awa Diallo", "Fifadji"]])
  })

  it("respecte les guillemets, les séparateurs et les guillemets doublés", () => {
    const text = 'Bien,Adresse,Note\n"Résidence, Fifadji","Rue 12.45","Dit ""la cour"""'
    const table = parseDelimited(text)

    expect(table.rows[0]).toEqual(["Résidence, Fifadji", "Rue 12.45", 'Dit "la cour"'])
  })

  it("garde un retour à la ligne contenu dans un champ cité", () => {
    const table = parseDelimited('Bien;Note\nFifadji;"Cour arrière\nportail bleu"')

    expect(table.rows).toHaveLength(1)
    expect(table.rows[0][1]).toBe("Cour arrière\nportail bleu")
  })

  it("lit un collage de cellules Excel séparées par des tabulations", () => {
    const table = parseDelimited("Propriétaire\tBien\tLot\nAwa Diallo\tFifadji\tA1")

    expect(table.delimiter).toBe("\t")
    expect(table.headers).toEqual(["Propriétaire", "Bien", "Lot"])
    expect(table.rows).toEqual([["Awa Diallo", "Fifadji", "A1"]])
  })

  it("accepte les fins de ligne Windows et un dernier saut de ligne", () => {
    const table = parseDelimited("Bien;Lot\r\nFifadji;A1\r\nFifadji;A2\r\n")

    expect(table.rows).toEqual([
      ["Fifadji", "A1"],
      ["Fifadji", "A2"],
    ])
  })

  it("écarte les lignes vides et complète les colonnes manquantes", () => {
    const table = parseDelimited("Bien;Lot;Loyer\nFifadji;A1\n;;\n\nFifadji;A2;80000")

    expect(table.rows).toEqual([
      ["Fifadji", "A1", ""],
      ["Fifadji", "A2", "80000"],
    ])
  })

  it("nettoie les espaces, y compris l'espace insécable des montants collés", () => {
    const table = parseDelimited("Bien ; Loyer\n Fifadji ;\u00a0125\u00a0000\u00a0")

    expect(table.headers).toEqual(["Bien", "Loyer"])
    expect(table.rows).toEqual([["Fifadji", "125\u00a0000"]])
  })

  it("renvoie un tableau vide pour une saisie vide", () => {
    expect(parseDelimited("   ")).toEqual({ headers: [], rows: [], delimiter: "," })
  })

  it("relit le modèle téléchargeable qu'il produit", () => {
    const table = parseDelimited(buildTemplateCsv())

    expect(table.delimiter).toBe(";")
    expect(table.headers[0]).toBe("Propriétaire")
    expect(table.rows).toHaveLength(2)
    // La seconde ligne d'exemple est un lot vacant : aucun locataire.
    expect(table.rows[1][10]).toBe("")
    expect(table.rows[1][12]).toBe("")
  })
})

// Régression : un fichier point-virgule dont une colonne d'adresse contient
// plus de virgules que le fichier n'a de points-virgules. Le comptage brut
// choisissait la virgule et fusionnait toutes les colonnes.
describe("detectDelimiter — régularité plutôt que fréquence", () => {
  it("garde le point-virgule malgré des virgules plus nombreuses dans les champs", () => {
    const text = [
      'bien;adresse;loyer',
      'Cour Zogbo;"Lot 12, rue 4, quartier Zogbo, Cotonou";50000',
      'Cour Fidjrossè;"Lot 3, rue 8, carré 21, Cotonou";75000',
    ].join("\n")
    expect(detectDelimiter(text)).toBe(";")
  })

  it("choisit la virgule sur un fichier réellement séparé par des virgules", () => {
    const text = "bien,lot,loyer\nCour A,Ch. 1,50000\nCour B,Ch. 2,60000"
    expect(detectDelimiter(text)).toBe(",")
  })
})
