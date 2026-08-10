// Correspondance entre les en-têtes du fichier de l'agence et les champs du
// registre. Personne ne renommera ses colonnes pour entrer dans le produit :
// on reconnaît « Propriétaire », « Immeuble », « N° Lot », « Loyer mensuel »
// tout seuls, et l'agence corrige au menu déroulant ce qui reste.

import type { ParsedTable } from "./csv"
import {
  IMPORT_FIELDS,
  emptyImportRow,
  type ImportField,
  type ImportFieldKey,
  type ImportRow,
} from "./fields"
import {
  feePercentToBasisPoints,
  normalizeAmountText,
  normalizeCurrencyText,
  normalizeDateText,
  normalizeDueDayText,
  normalizeLabel,
  normalizePhoneText,
  normalizeUnitTypeText,
  splitFullName,
} from "./values"

// Mots vides d'un en-tête : « Nom du bien » et « Nom bien » désignent la même
// colonne.
const STOP_WORDS = new Set([
  "a", "au", "aux", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les",
  "n", "ou", "par", "pour", "sur", "un", "une",
])

export function headerTokens(label: string): string[] {
  return normalizeLabel(label)
    .split(" ")
    .filter((token) => token !== "" && !STOP_WORDS.has(token))
}

export function canonicalHeader(label: string): string {
  return headerTokens(label).join(" ")
}

// « tel » reconnaît « telephone », « prop » reconnaît « proprietaire ».
function prefixMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 3) return false
  return a.startsWith(b) || b.startsWith(a)
}

const MATCH_THRESHOLD = 50

/**
 * Score de ressemblance entre un en-tête et un champ (0 à 100). Volontairement
 * lisible et déterministe plutôt que savant : on veut pouvoir expliquer
 * pourquoi une colonne a été reconnue.
 */
export function scoreHeader(header: string, field: ImportField): number {
  const canonical = canonicalHeader(header)
  if (!canonical) return 0

  const tokens = canonical.split(" ")
  const glued = canonical.replace(/ /g, "")
  let best = 0

  for (const alias of field.aliases) {
    const aliasCanonical = canonicalHeader(alias)
    if (!aliasCanonical) continue

    const aliasTokens = aliasCanonical.split(" ")
    const aliasGlued = aliasCanonical.replace(/ /g, "")
    let score = 0

    if (canonical === aliasCanonical) {
      score = 100
    } else if (aliasTokens.every((token) => tokens.includes(token))) {
      // L'alias est contenu dans l'en-tête : « Loyer mensuel (FCFA) » ⊃ « loyer ».
      score = 78 + (aliasTokens.length > 1 ? 6 : 0) - Math.min(tokens.length - aliasTokens.length, 4)
    } else if (tokens.every((token) => aliasTokens.includes(token))) {
      // L'en-tête est plus court que l'alias : « Téléphone » vs « téléphone du locataire ».
      score = 62
    } else if (glued.includes(aliasGlued) || aliasGlued.includes(glued)) {
      score = 56
    } else {
      const matched = aliasTokens.filter((token) =>
        tokens.some((candidate) => prefixMatch(candidate, token)),
      ).length
      if (matched === aliasTokens.length) score = 52
      else if (matched > 0) score = 40 + Math.round((matched / aliasTokens.length) * 10)
    }

    if (score > best) best = score
  }

  return best
}

/**
 * Propose un champ pour chaque colonne du fichier. Un champ n'est attribué
 * qu'une fois : le meilleur score gagne, les colonnes restantes sont laissées
 * à « Ignorer » et l'agence tranche.
 */
export function autoMapColumns(headers: string[]): (ImportFieldKey | null)[] {
  const mapping: (ImportFieldKey | null)[] = headers.map(() => null)
  const takenFields = new Set<ImportFieldKey>()

  const candidates: { header: number; field: number; score: number }[] = []
  headers.forEach((header, headerIndex) => {
    IMPORT_FIELDS.forEach((field, fieldIndex) => {
      const score = scoreHeader(header, field)
      if (score >= MATCH_THRESHOLD) {
        candidates.push({ header: headerIndex, field: fieldIndex, score })
      }
    })
  })

  candidates.sort(
    (a, b) => b.score - a.score || a.header - b.header || a.field - b.field,
  )

  for (const candidate of candidates) {
    const field = IMPORT_FIELDS[candidate.field]
    if (mapping[candidate.header] !== null) continue
    if (takenFields.has(field.key)) continue
    mapping[candidate.header] = field.key
    takenFields.add(field.key)
  }

  return mapping
}

function isRowEmpty(row: ImportRow): boolean {
  return Object.values(row).every((value) => value.trim() === "")
}

/**
 * Applique la correspondance au tableau et normalise chaque valeur pour la
 * base (montants entiers, dates ISO, type de lot, honoraires en points de
 * base). Les lignes entièrement vides sont écartées.
 */
export function buildImportRows(
  table: ParsedTable,
  mapping: (ImportFieldKey | null)[],
): ImportRow[] {
  const rows: ImportRow[] = []

  for (const cells of table.rows) {
    const row = emptyImportRow()
    mapping.forEach((key, index) => {
      if (!key) return
      row[key] = (cells[index] ?? "").trim()
    })

    if (isRowEmpty(row)) continue

    row.monthly_rent_amount = normalizeAmountText(row.monthly_rent_amount)
    row.owner_fee_rate_bp = feePercentToBasisPoints(row.owner_fee_rate_bp)
    row.due_day = normalizeDueDayText(row.due_day)
    row.start_date = normalizeDateText(row.start_date)
    row.end_date = normalizeDateText(row.end_date)
    row.unit_type = normalizeUnitTypeText(row.unit_type)
    row.currency = normalizeCurrencyText(row.currency)
    row.tenant_phone = normalizePhoneText(row.tenant_phone)

    // Le fichier ne porte souvent qu'une colonne de nom : on la sépare pour
    // remplir prénom ET nom, tous deux obligatoires côté registre.
    if (!row.tenant_first_name && row.tenant_last_name) {
      const split = splitFullName(row.tenant_last_name)
      if (split) {
        row.tenant_first_name = split.first
        row.tenant_last_name = split.last
      }
    } else if (row.tenant_first_name && !row.tenant_last_name) {
      const split = splitFullName(row.tenant_first_name)
      if (split) {
        row.tenant_first_name = split.first
        row.tenant_last_name = split.last
      }
    }

    rows.push(row)
  }

  return rows
}

/**
 * Contrôles que la validation SQL ne fait pas : elle accepte un locataire avec
 * un seul nom, alors que l'insertion l'exigera complet. Mieux vaut le dire à
 * l'aperçu que faire échouer un import de 60 lignes.
 */
export function localRowErrors(row: ImportRow): string[] {
  const errors: string[] = []
  const hasTenant =
    row.tenant_first_name !== "" || row.tenant_last_name !== "" || row.tenant_phone !== ""

  if (hasTenant && (row.tenant_first_name === "" || row.tenant_last_name === "")) {
    errors.push("Prénom et nom du locataire attendus (ou le nom complet dans une seule colonne)")
  }

  return errors
}
