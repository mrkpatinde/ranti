import { describe, expect, it } from "vitest"
import { parseDelimited } from "../csv"
import { IMPORT_FIELDS, type ImportField, type ImportFieldKey } from "../fields"
import {
  CONFIDENCE_THRESHOLD,
  autoMapColumns,
  buildImportRows,
  columnCandidates,
  columnSamples,
  localRowErrors,
  missingEssentialKeys,
  scoreHeader,
  understandTable,
} from "../mapping"
import { buildTemplateCsv } from "../template"

function fieldByKey(key: ImportFieldKey): ImportField {
  const field = IMPORT_FIELDS.find((item) => item.key === key)
  if (!field) throw new Error(`champ inconnu : ${key}`)
  return field
}

describe("autoMapColumns", () => {
  it("reconnaît les en-têtes d'une agence francophone", () => {
    const headers = [
      "Propriétaire",
      "Immeuble",
      "N° Lot",
      "Type",
      "Prénom",
      "Nom",
      "Téléphone",
      "Loyer mensuel (FCFA)",
      "Jour",
      "Date d'entrée",
    ]

    expect(autoMapColumns(headers)).toEqual([
      "owner_name",
      "property_name",
      "unit_name",
      "unit_type",
      "tenant_first_name",
      "tenant_last_name",
      "tenant_phone",
      "monthly_rent_amount",
      "due_day",
      "start_date",
    ])
  })

  it("distingue le téléphone du mandant de celui du locataire", () => {
    const mapping = autoMapColumns(["Tél. propriétaire", "Téléphone du locataire"])

    expect(mapping).toEqual(["owner_phone", "tenant_phone"])
  })

  it("accepte les synonymes de bien et de lot", () => {
    expect(autoMapColumns(["Résidence", "Chambre"])).toEqual(["property_name", "unit_name"])
    expect(autoMapColumns(["Cour", "Logement"])).toEqual(["property_name", "unit_name"])
    expect(autoMapColumns(["Bâtiment", "Appartement"])).toEqual(["property_name", "unit_name"])
  })

  it("reconnaît mandant, bailleur et honoraires", () => {
    expect(autoMapColumns(["Mandant", "Taux de gestion"])).toEqual([
      "owner_name",
      "owner_fee_rate_bp",
    ])
    expect(autoMapColumns(["Bailleur", "Honoraires (%)"])).toEqual([
      "owner_name",
      "owner_fee_rate_bp",
    ])
  })

  it("laisse une colonne inconnue sans correspondance", () => {
    expect(autoMapColumns(["Superficie", "Étage", ""])).toEqual([null, null, null])
  })

  it("n'attribue jamais deux fois le même champ", () => {
    const mapping = autoMapColumns(["Loyer", "Loyer mensuel", "Montant"])
    const assigned = mapping.filter((key) => key !== null)

    expect(new Set(assigned).size).toBe(assigned.length)
    expect(mapping[0]).toBe("monthly_rent_amount")
  })

  it("associe l'export d'une agence sans lui faire renommer une colonne", () => {
    const headers = [
      "Propriétaire",
      "Tél. propriétaire",
      "Honoraires (%)",
      "Immeuble",
      "Ville",
      "Quartier",
      "N° Lot",
      "Nature",
      "Locataire",
      "Contact",
      "Loyer mensuel",
      "Jour de paiement",
      "Date d'entrée",
      "Observation",
    ]

    expect(autoMapColumns(headers)).toEqual([
      "owner_name",
      "owner_phone",
      "owner_fee_rate_bp",
      "property_name",
      "property_city",
      "property_address",
      "unit_name",
      "unit_type",
      "tenant_last_name",
      "tenant_phone",
      "monthly_rent_amount",
      "due_day",
      "start_date",
      "unit_notes",
    ])
  })

  it("retrouve tous les champs du modèle téléchargeable", () => {
    const table = parseDelimited(buildTemplateCsv())
    const mapping = autoMapColumns(table.headers)

    expect(mapping).toEqual([
      "owner_name",
      "owner_phone",
      "owner_email",
      "owner_fee_rate_bp",
      "property_name",
      "property_city",
      "property_address",
      "unit_name",
      "unit_type",
      "unit_notes",
      "tenant_first_name",
      "tenant_last_name",
      "tenant_phone",
      "tenant_email",
      "monthly_rent_amount",
      "due_day",
      "start_date",
      "end_date",
    ])
  })
})

describe("buildImportRows", () => {
  it("normalise montants, dates, type de lot et honoraires", () => {
    const table = parseDelimited(
      [
        "Propriétaire;Taux;Immeuble;Lot;Type;Nom;Prénom;Téléphone;Loyer;Jour;Date d'entrée",
        "Awa Diallo;8,5;Résidence Fifadji;A1;Chambre;Kossou;Aïcha;+229 01 90 00 00 00;125 000 FCFA;5;01/03/2026",
      ].join("\n"),
    )
    const rows = buildImportRows(table, autoMapColumns(table.headers))

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      owner_name: "Awa Diallo",
      owner_fee_rate_bp: "850",
      property_name: "Résidence Fifadji",
      unit_name: "A1",
      unit_type: "room",
      tenant_first_name: "Aïcha",
      tenant_last_name: "Kossou",
      monthly_rent_amount: "125000",
      due_day: "5",
      start_date: "2026-03-01",
    })
  })

  it("met le numéro du locataire au format attendu par les relances", () => {
    const table = parseDelimited(
      [
        "Immeuble;Lot;Locataire;Téléphone",
        "Fifadji;A1;Aïcha Kossou;01 90 00 00 00",
        "Fifadji;A2;Jean Hounsou;+33 6 12 34 56 78",
        "Fifadji;A3;Ana Silva;00229 0196000000",
      ].join("\n"),
    )
    const rows = buildImportRows(table, autoMapColumns(table.headers))

    expect(rows[0].tenant_phone).toBe("+2290190000000")
    expect(rows[1].tenant_phone).toBe("+33612345678")
    expect(rows[2].tenant_phone).toBe("+2290196000000")
  })

  it("coupe un nom complet reçu dans une seule colonne", () => {
    const table = parseDelimited("Immeuble\tLot\tLocataire\tTéléphone\nFifadji\tA1\tAïcha Kossou\t0190000000")
    const rows = buildImportRows(table, autoMapColumns(table.headers))

    expect(rows[0].tenant_first_name).toBe("Aïcha")
    expect(rows[0].tenant_last_name).toBe("Kossou")
    expect(localRowErrors(rows[0])).toEqual([])
  })

  it("laisse un lot vacant sans locataire ni bail", () => {
    const table = parseDelimited("Immeuble;Lot;Locataire;Téléphone;Loyer\nFifadji;A2;;;80000")
    const rows = buildImportRows(table, autoMapColumns(table.headers))

    expect(rows[0].tenant_first_name).toBe("")
    expect(rows[0].tenant_phone).toBe("")
    expect(rows[0].monthly_rent_amount).toBe("80000")
    expect(localRowErrors(rows[0])).toEqual([])
  })

  it("signale un locataire dont le nom ne peut pas être coupé", () => {
    const table = parseDelimited("Immeuble;Lot;Locataire;Téléphone\nFifadji;A1;Aïcha;0190000000")
    const rows = buildImportRows(table, autoMapColumns(table.headers))

    expect(localRowErrors(rows[0])).toHaveLength(1)
  })

  it("ignore les colonnes non associées et les lignes vides", () => {
    const table = parseDelimited("Immeuble;Superficie;Lot\nFifadji;120 m2;A1\n;;\n")
    const mapping = autoMapColumns(table.headers)
    const rows = buildImportRows(table, mapping)

    expect(mapping[1]).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows[0].property_name).toBe("Fifadji")
  })

  it("applique le nom d'immeuble de repli à toutes les lignes", () => {
    const table = parseDelimited(
      "Lot;Locataire;Téléphone\nA1;Aïcha Kossou;0190000000\nA2;;",
    )
    const rows = buildImportRows(table, autoMapColumns(table.headers), {
      property_name: "Résidence Fifadji",
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].property_name).toBe("Résidence Fifadji")
    expect(rows[1].property_name).toBe("Résidence Fifadji")
  })

  it("le repli ne remplace jamais une valeur présente dans le fichier", () => {
    const table = parseDelimited("Immeuble;Lot\nZogbo;A1\n;A2")
    const rows = buildImportRows(table, autoMapColumns(table.headers), {
      property_name: "Fifadji",
    })

    expect(rows[0].property_name).toBe("Zogbo")
    expect(rows[1].property_name).toBe("Fifadji")
  })

  it("le repli ne ressuscite pas une ligne entièrement vide", () => {
    const table = parseDelimited("Immeuble;Lot\nFifadji;A1\n;")
    const rows = buildImportRows(table, autoMapColumns(table.headers), {
      property_name: "Fifadji",
    })

    expect(rows).toHaveLength(1)
  })
})

describe("seuil de confiance", () => {
  it("se situe entre l'indice partiel et la reconnaissance d'un alias", () => {
    expect(CONFIDENCE_THRESHOLD).toBeGreaterThan(50)
    expect(CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(78)
  })

  it("« Immeuble » passe sans question, « Date » seul reste en dessous", () => {
    expect(scoreHeader("Immeuble", fieldByKey("property_name"))).toBeGreaterThanOrEqual(
      CONFIDENCE_THRESHOLD,
    )
    expect(scoreHeader("Loyer mensuel (FCFA)", fieldByKey("monthly_rent_amount"))).toBeGreaterThanOrEqual(
      CONFIDENCE_THRESHOLD,
    )
    // « Date » peut être un début ou une fin de bail : en dessous du seuil.
    expect(scoreHeader("Date", fieldByKey("start_date"))).toBeLessThan(CONFIDENCE_THRESHOLD)
    expect(scoreHeader("Date", fieldByKey("end_date"))).toBeLessThan(CONFIDENCE_THRESHOLD)
  })
})

describe("understandTable", () => {
  const CLEAN_FILE = [
    "Propriétaire;Immeuble;N° Lot;Prénom;Nom;Téléphone;Loyer mensuel (FCFA);Jour;Date d'entrée",
    "Awa Diallo;Fifadji;A1;Aïcha;Kossou;0190000000;125000;5;01/03/2026",
    "Awa Diallo;Fifadji;A2;;;;80000;5;",
  ].join("\n")

  it("fichier propre : zéro question, droit au récapitulatif", () => {
    const understanding = understandTable(parseDelimited(CLEAN_FILE))

    expect(understanding.questions).toEqual([])
    expect(understanding.ignoredColumns).toEqual([])
    expect(understanding.needsPropertyQuestion).toBe(false)
    expect(understanding.hasTenants).toBe(true)
    expect(understanding.clear).toBe(true)
  })

  it("colonne ambiguë : une question, avec les candidats les plus probables", () => {
    const table = parseDelimited(
      [
        "Immeuble;Lot;Locataire;Téléphone;Loyer;Jour;Date",
        "Fifadji;A1;Aïcha Kossou;0190000000;125000;5;01/03/2026",
      ].join("\n"),
    )
    const understanding = understandTable(table)

    expect(understanding.clear).toBe(false)
    expect(understanding.questions).toHaveLength(1)
    expect(understanding.questions[0].header).toBe("Date")
    expect(understanding.questions[0].samples).toEqual(["01/03/2026"])

    const keys = understanding.questions[0].candidates.map((candidate) => candidate.key)
    expect(keys).toContain("start_date")
    expect(keys).toContain("end_date")
  })

  it("fichier sans immeuble : la question de l'immeuble unique, aucune autre", () => {
    const table = parseDelimited(
      [
        "Lot;Locataire;Téléphone;Loyer;Jour;Date d'entrée",
        "A1;Aïcha Kossou;0190000000;125000;5;01/03/2026",
        "A2;;;80000;5;",
      ].join("\n"),
    )
    const understanding = understandTable(table)

    expect(understanding.questions).toEqual([])
    expect(understanding.needsPropertyQuestion).toBe(true)
    expect(understanding.clear).toBe(false)
  })

  it("colonne inconnue : écartée d'office, sans question ni blocage", () => {
    const table = parseDelimited("Immeuble;Lot;Superficie\nFifadji;A1;120 m2")
    const understanding = understandTable(table)

    expect(understanding.questions).toEqual([])
    expect(understanding.ignoredColumns).toEqual([2])
    // Une colonne écartée n'est pas ambiguë : le récapitulatif arrive direct.
    expect(understanding.clear).toBe(true)
  })

  it("locataires présents sans jour ni date d'entrée : pas de saut direct", () => {
    const table = parseDelimited(
      "Immeuble;Lot;Locataire;Téléphone;Loyer\nFifadji;A1;Aïcha Kossou;0190000000;125000",
    )
    const understanding = understandTable(table)

    expect(understanding.questions).toEqual([])
    expect(understanding.hasTenants).toBe(true)
    expect(understanding.clear).toBe(false)
    expect(missingEssentialKeys(table, understanding.mapping)).toEqual(["due_day", "start_date"])
  })

  it("sans locataire, seuls le bien et le lot sont exigés", () => {
    const table = parseDelimited("Immeuble;Lot;Loyer\nFifadji;A1;80000")
    const understanding = understandTable(table)

    expect(understanding.hasTenants).toBe(false)
    expect(understanding.clear).toBe(true)
  })
})

describe("missingEssentialKeys", () => {
  it("le repli d'immeuble couvre la colonne manquante", () => {
    const table = parseDelimited("Lot;Loyer\nA1;125000")
    const mapping = autoMapColumns(table.headers)

    expect(missingEssentialKeys(table, mapping, false)).toEqual(["property_name"])
    expect(missingEssentialKeys(table, mapping, true)).toEqual([])
  })
})

describe("columnCandidates", () => {
  it("écarte les rôles déjà pris et garde l'ordre des scores", () => {
    const candidates = columnCandidates("Date", new Set<ImportFieldKey>(["start_date"]))

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].key).toBe("end_date")
    expect(candidates.some((candidate) => candidate.key === "start_date")).toBe(false)
  })
})

describe("columnSamples", () => {
  it("donne jusqu'à trois vraies valeurs distinctes, dans l'ordre du fichier", () => {
    const table = parseDelimited(
      "Lot;Type\nA1;Chambre\nA2;Chambre\nA3;\nA4;Studio\nA5;Villa\nA6;Duplex",
    )

    expect(columnSamples(table.rows, 1)).toEqual(["Chambre", "Studio", "Villa"])
  })
})
