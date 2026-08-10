// Correspondance entre les en-têtes du fichier de l'agence et les champs du
// registre. Personne ne renommera ses colonnes pour entrer dans le produit :
// on reconnaît « Propriétaire », « Immeuble », « N° Lot », « Loyer mensuel »
// tout seuls. Ce qui est reconnu avec confiance ne se montre pas ; ce qui
// reste douteux devient UNE question à la fois côté écran (`understandTable`),
// jamais une grille de dix-neuf menus déroulants.

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
 * Seuil au-delà duquel une colonne est considérée comprise sans rien demander.
 * Dans l'échelle de `scoreHeader` : 100 = en-tête identique à un alias, ≥ 74 =
 * alias contenu dans l'en-tête (« Loyer mensuel (FCFA) » ⊃ « loyer mensuel »).
 * En dessous restent les indices — en-tête plus court que l'alias (62, « Date »
 * peut être un début ou une fin de bail), collage approximatif (56), simple
 * préfixe (52) — qui méritent une question plutôt qu'un pari silencieux.
 */
export const CONFIDENCE_THRESHOLD = 70

const FIELD_ORDER = new Map<ImportFieldKey, number>(
  IMPORT_FIELDS.map((field, index) => [field.key, index]),
)

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

export type ScoredMapping = {
  mapping: (ImportFieldKey | null)[]
  // Score de l'attribution retenue pour chaque colonne (0 si aucune).
  scores: number[]
}

/**
 * Propose un champ pour chaque colonne du fichier, avec le score de chaque
 * attribution. Un champ n'est attribué qu'une fois : le meilleur score gagne,
 * les colonnes restantes sont laissées de côté.
 */
export function autoMapColumnsScored(headers: string[]): ScoredMapping {
  const mapping: (ImportFieldKey | null)[] = headers.map(() => null)
  const scores: number[] = headers.map(() => 0)
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
    scores[candidate.header] = candidate.score
    takenFields.add(field.key)
  }

  return { mapping, scores }
}

export function autoMapColumns(headers: string[]): (ImportFieldKey | null)[] {
  return autoMapColumnsScored(headers).mapping
}

export type ColumnCandidate = { key: ImportFieldKey; score: number }

/**
 * Tous les champs plausibles pour un en-tête, du plus probable au moins
 * probable. `exclude` retire les champs déjà attribués ailleurs.
 */
export function columnCandidates(
  header: string,
  exclude?: ReadonlySet<ImportFieldKey>,
): ColumnCandidate[] {
  return IMPORT_FIELDS.map((field) => ({ key: field.key, score: scoreHeader(header, field) }))
    .filter((candidate) => candidate.score > 0 && !exclude?.has(candidate.key))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (FIELD_ORDER.get(a.key) ?? 0) - (FIELD_ORDER.get(b.key) ?? 0),
    )
}

/**
 * Les 3 à 5 propositions d'une question de clarification. Vide si aucun champ
 * n'atteint le score minimal : la colonne est alors écartée sans question.
 */
export function questionCandidates(
  header: string,
  exclude?: ReadonlySet<ImportFieldKey>,
): ColumnCandidate[] {
  const all = columnCandidates(header, exclude)
  const strong = all.filter((candidate) => candidate.score >= MATCH_THRESHOLD)
  if (strong.length === 0) return []
  return all.slice(0, Math.min(5, Math.max(3, strong.length)))
}

/** Jusqu'à `limit` vraies valeurs distinctes d'une colonne, dans l'ordre du fichier. */
export function columnSamples(rows: string[][], column: number, limit = 3): string[] {
  const seen = new Set<string>()
  const samples: string[] = []

  for (const cells of rows) {
    const value = (cells[column] ?? "").trim()
    if (value === "" || seen.has(value)) continue
    seen.add(value)
    samples.push(value)
    if (samples.length >= limit) break
  }

  return samples
}

const TENANT_KEYS: ImportFieldKey[] = ["tenant_first_name", "tenant_last_name", "tenant_phone"]

/** Vrai si une colonne de locataire est attribuée ET porte au moins une valeur. */
export function tenantsPresent(
  table: Pick<ParsedTable, "rows">,
  mapping: (ImportFieldKey | null)[],
): boolean {
  const columns: number[] = []
  mapping.forEach((key, index) => {
    if (key !== null && TENANT_KEYS.includes(key)) columns.push(index)
  })
  if (columns.length === 0) return false

  return table.rows.some((cells) => columns.some((index) => (cells[index] ?? "").trim() !== ""))
}

/**
 * Ce qui manque encore pour comprendre le portefeuille : le bien et le lot de
 * chaque ligne, et — dès que des locataires sont présents — le loyer, le jour
 * d'échéance et la date d'entrée, sans lesquels aucun bail ne s'active.
 * `hasPropertyFallback` couvre le cas « tous les lots dans le même immeuble »,
 * où le nom vient d'une réponse et non d'une colonne.
 */
export function missingEssentialKeys(
  table: Pick<ParsedTable, "rows">,
  mapping: (ImportFieldKey | null)[],
  hasPropertyFallback = false,
): ImportFieldKey[] {
  const required: ImportFieldKey[] = ["property_name", "unit_name"]
  if (tenantsPresent(table, mapping)) {
    required.push("monthly_rent_amount", "due_day", "start_date")
  }

  return required.filter((key) => {
    if (key === "property_name" && hasPropertyFallback) return false
    return !mapping.includes(key)
  })
}

export type ColumnQuestion = {
  column: number
  header: string
  // Vraies valeurs tirées du fichier, pour que l'agence reconnaisse sa colonne.
  samples: string[]
  candidates: ColumnCandidate[]
}

export type TableUnderstanding = {
  mapping: (ImportFieldKey | null)[]
  scores: number[]
  // Colonnes à clarifier, une question à la fois, dans l'ordre du fichier.
  questions: ColumnQuestion[]
  // Colonnes écartées d'office : aucun champ plausible.
  ignoredColumns: number[]
  // Aucune colonne d'immeuble : poser la question « même immeuble ? ».
  needsPropertyQuestion: boolean
  hasTenants: boolean
  // Tout est compris avec confiance : droit au récapitulatif, zéro question.
  clear: boolean
}

/**
 * Lecture complète du fichier : ce qui est compris, ce qui mérite une question,
 * ce qui est écarté. C'est cette analyse qui décide si l'agence voit d'abord
 * le récapitulatif — le cas normal — ou une ou deux questions.
 */
export function understandTable(
  table: Pick<ParsedTable, "headers" | "rows">,
): TableUnderstanding {
  const { mapping, scores } = autoMapColumnsScored(table.headers)

  const confident = new Set<ImportFieldKey>()
  mapping.forEach((key, index) => {
    if (key !== null && scores[index] >= CONFIDENCE_THRESHOLD) confident.add(key)
  })

  const questions: ColumnQuestion[] = []
  const ignoredColumns: number[] = []

  table.headers.forEach((header, index) => {
    if (mapping[index] !== null && scores[index] >= CONFIDENCE_THRESHOLD) return

    const candidates = questionCandidates(header, confident)
    if (candidates.length === 0) {
      ignoredColumns.push(index)
      return
    }

    questions.push({
      column: index,
      header: header === "" ? `Colonne ${index + 1}` : header,
      samples: columnSamples(table.rows, index),
      candidates,
    })
  })

  const hasTenants = tenantsPresent(table, mapping)
  const needsPropertyQuestion = !mapping.includes("property_name")

  const required: ImportFieldKey[] = ["property_name", "unit_name"]
  if (hasTenants) required.push("monthly_rent_amount", "due_day", "start_date")

  const clear = questions.length === 0 && required.every((key) => confident.has(key))

  return { mapping, scores, questions, ignoredColumns, needsPropertyQuestion, hasTenants, clear }
}

function isRowEmpty(row: ImportRow): boolean {
  return Object.values(row).every((value) => value.trim() === "")
}

/**
 * Applique la correspondance au tableau et normalise chaque valeur pour la
 * base (montants entiers, dates ISO, type de lot, honoraires en points de
 * base). Les lignes entièrement vides sont écartées. `defaults` remplit les
 * valeurs absentes — le nom d'immeuble répondu à « Ces lots sont dans le même
 * immeuble ? » s'applique ainsi à toutes les lignes, sans écraser une valeur
 * présente.
 */
export function buildImportRows(
  table: ParsedTable,
  mapping: (ImportFieldKey | null)[],
  defaults?: Partial<Record<ImportFieldKey, string>>,
): ImportRow[] {
  const rows: ImportRow[] = []

  for (const cells of table.rows) {
    const row = emptyImportRow()
    mapping.forEach((key, index) => {
      if (!key) return
      row[key] = (cells[index] ?? "").trim()
    })

    if (isRowEmpty(row)) continue

    if (defaults) {
      for (const [key, value] of Object.entries(defaults) as [ImportFieldKey, string][]) {
        if (row[key] === "" && value.trim() !== "") row[key] = value.trim()
      }
    }

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
