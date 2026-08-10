import { describe, expect, it } from "vitest"
import { parseDelimited } from "../csv"
import { autoMapColumns, buildImportRows, localRowErrors } from "../mapping"
import { buildTemplateCsv } from "../template"

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
})
