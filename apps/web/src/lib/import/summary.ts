// Synthèse humaine du fichier compris — ce que l'écran montre AVANT d'importer :
// « 2 propriétaires · 3 immeubles · 10 lots · 8 locataires · 2 lots vacants »,
// puis le détail propriétaire → immeuble → lots. On montre le résultat de la
// lecture, jamais la mécanique qui l'a produite.

import type { ImportRow } from "./fields"
import { normalizeLabel } from "./values"

export type SummaryUnit = {
  // Numéro de ligne 1-indexé, aligné sur ValidationLine.line : les erreurs de
  // validation se raccrochent à chaque lot par ce numéro.
  line: number
  name: string
  // Nom du locataire, ou son téléphone s'il n'a que ça ; null = lot vacant.
  tenantName: string | null
  // Loyer mensuel entier (FCFA) si lisible, sinon null — l'écran ne montre
  // jamais un montant douteux.
  rent: number | null
}

export type SummaryProperty = {
  name: string
  units: SummaryUnit[]
}

export type SummaryOwner = {
  // "" quand le fichier ne nomme pas de propriétaire : le groupe existe quand
  // même pour porter ses immeubles.
  name: string
  properties: SummaryProperty[]
}

export type PortfolioSummary = {
  owners: SummaryOwner[]
  // Propriétaires distincts réellement nommés (le groupe anonyme ne compte pas).
  ownerCount: number
  propertyCount: number
  unitCount: number
  tenantCount: number
  vacantCount: number
}

/**
 * Regroupe les lignes prêtes pour l'import en portefeuille lisible :
 * propriétaire → immeuble → lots, dans l'ordre du fichier. Le regroupement
 * ignore casse et accents (« AWA DIALLO » et « Awa Diallo » sont la même
 * personne) mais affiche la première orthographe rencontrée.
 */
export function buildPortfolioSummary(rows: ImportRow[]): PortfolioSummary {
  const owners: SummaryOwner[] = []
  const ownerByKey = new Map<string, SummaryOwner>()
  const propertyByKey = new Map<string, SummaryProperty>()
  let tenantCount = 0

  rows.forEach((row, index) => {
    const ownerKey = normalizeLabel(row.owner_name)
    let owner = ownerByKey.get(ownerKey)
    if (!owner) {
      owner = { name: row.owner_name.trim(), properties: [] }
      ownerByKey.set(ownerKey, owner)
      owners.push(owner)
    }

    const propertyKey = `${ownerKey}|${normalizeLabel(row.property_name)}`
    let property = propertyByKey.get(propertyKey)
    if (!property) {
      property = { name: row.property_name.trim(), units: [] }
      propertyByKey.set(propertyKey, property)
      owner.properties.push(property)
    }

    const tenantName = `${row.tenant_first_name} ${row.tenant_last_name}`.trim()
    const tenantPhone = row.tenant_phone.trim()
    const hasTenant = tenantName !== "" || tenantPhone !== ""
    if (hasTenant) tenantCount += 1

    property.units.push({
      line: index + 1,
      name: row.unit_name.trim(),
      tenantName: hasTenant ? tenantName || tenantPhone : null,
      rent: /^\d+$/.test(row.monthly_rent_amount)
        ? Number.parseInt(row.monthly_rent_amount, 10)
        : null,
    })
  })

  const ownerCount = owners.filter((owner) => owner.name !== "").length
  const propertyCount = owners.reduce((total, owner) => total + owner.properties.length, 0)
  const unitCount = rows.length

  return {
    owners,
    ownerCount,
    propertyCount,
    unitCount,
    tenantCount,
    vacantCount: unitCount - tenantCount,
  }
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/**
 * La phrase de synthèse du récapitulatif. Les segments absents disparaissent :
 * un fichier sans propriétaire nommé ne dit pas « 0 propriétaire ».
 */
export function summaryLine(summary: PortfolioSummary): string {
  const parts: string[] = []

  if (summary.ownerCount > 0) {
    parts.push(countLabel(summary.ownerCount, "propriétaire", "propriétaires"))
  }
  if (summary.propertyCount > 0) {
    parts.push(countLabel(summary.propertyCount, "immeuble", "immeubles"))
  }
  parts.push(countLabel(summary.unitCount, "lot", "lots"))
  if (summary.tenantCount > 0) {
    parts.push(countLabel(summary.tenantCount, "locataire", "locataires"))
  }
  if (summary.vacantCount > 0) {
    parts.push(countLabel(summary.vacantCount, "lot vacant", "lots vacants"))
  }

  return parts.join(" · ")
}
