// Parseur de tableau texte — écrit ici, sans dépendance : le fichier d'une
// agence n'est jamais propre (Excel francophone exporte en point-virgule, avec
// BOM UTF-8, et parfois en Windows-1252 ; un collage direct depuis Excel arrive
// séparé par des tabulations). Un parseur maison de 100 lignes couvre ces trois
// réalités mieux qu'une lib générique, et se teste.

export type ParsedTable = {
  // En-têtes de la première ligne, nettoyés.
  headers: string[]
  // Lignes de données, chacune ramenée à la longueur des en-têtes.
  rows: string[][]
  // Séparateur retenu (utile pour l'afficher à l'utilisateur si besoin).
  delimiter: string
}

const BOM = "\uFEFF"

// Séparateurs candidats, par ordre de priorité en cas d'égalité de comptage :
// la tabulation ne se trouve jamais dans une cellule collée, le point-virgule
// est l'export Excel francophone, la virgule est le défaut international.
const CANDIDATES = ["\t", ";", ","] as const

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text
}

// Trim large : espaces, tabulations, retours ET espace insécable (les cellules
// Excel en contiennent après un copier-coller de montant).
function trimCell(value: string): string {
  return value.replace(/^[\s\u00a0]+/, "").replace(/[\s\u00a0]+$/, "")
}

// Compte les occurrences hors guillemets — un point-virgule dans « Cotonou;
// Fidjrossè » entre guillemets ne doit pas voter pour le point-virgule.
function countOutsideQuotes(text: string, char: string): number {
  let count = 0
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && c === char) count += 1
  }

  return count
}

export function detectDelimiter(text: string): string {
  const sample = stripBom(text)

  // Le simple comptage d'occurrences se trompe sur un fichier point-virgule
  // dont une colonne d'adresse contient beaucoup de virgules : le mauvais
  // séparateur gagne et toutes les colonnes fusionnent. On juge sur la
  // régularité, seule propriété qu'un tableau possède et qu'un texte n'a pas :
  // le bon séparateur produit le même nombre de colonnes à chaque ligne.
  let best = ","
  let bestScore = -1

  for (const candidate of CANDIDATES) {
    if (countOutsideQuotes(sample, candidate) === 0) continue

    const rows = splitRows(sample, candidate).slice(0, 20)
    if (rows.length === 0) continue

    const columns = rows[0].length
    if (columns < 2) continue

    const regular = rows.filter((r) => r.length === columns).length / rows.length
    // La régularité prime ; à régularité égale, le découpage le plus fin
    // l'emporte, borné pour qu'un séparateur parasite très fréquent ne
    // devance pas le vrai.
    const score = regular * 100 + Math.min(columns, 30)

    // Strictement supérieur : à égalité, l'ordre de CANDIDATES tranche.
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

// Découpage caractère par caractère (RFC 4180 étendu) : guillemets, guillemet
// doublé à l'intérieur d'un champ, retours à la ligne dans un champ cité,
// fins de ligne \n, \r\n et \r.
function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let quoted = false
  let i = 0

  const pushField = () => {
    // Un champ cité garde son contenu tel quel ; un champ nu est trimé.
    row.push(quoted ? field : trimCell(field))
    field = ""
    quoted = false
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }

    // Guillemet ouvrant : uniquement en début de champ (les espaces qui le
    // précèdent sont de la mise en forme, pas de la donnée).
    if (c === '"' && trimCell(field) === "") {
      field = ""
      inQuotes = true
      quoted = true
      i += 1
      continue
    }

    if (c === delimiter) {
      pushField()
      i += 1
      continue
    }

    if (c === "\r") {
      pushRow()
      i += text[i + 1] === "\n" ? 2 : 1
      continue
    }

    if (c === "\n") {
      pushRow()
      i += 1
      continue
    }

    field += c
    i += 1
  }

  pushRow()

  return rows
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => trimCell(cell) === "")
}

/**
 * Convertit un fichier CSV, un CSV à point-virgule ou un collage de cellules
 * Excel (tabulations) en tableau exploitable. Le séparateur est détecté quand
 * il n'est pas fourni. Les lignes entièrement vides sont écartées.
 */
export function parseDelimited(input: string, delimiter?: string): ParsedTable {
  const text = stripBom(input)
  const sep = delimiter ?? detectDelimiter(text)

  if (trimCell(text) === "") {
    return { headers: [], rows: [], delimiter: sep }
  }

  const all = splitRows(text, sep).filter((cells) => !isBlankRow(cells))

  if (all.length === 0) {
    return { headers: [], rows: [], delimiter: sep }
  }

  const headers = all[0].map((cell) => trimCell(cell))
  const rows = all.slice(1).map((cells) => {
    const line = headers.map((_, index) => trimCell(cells[index] ?? ""))
    return line
  })

  return { headers, rows, delimiter: sep }
}

/**
 * Décode le contenu binaire d'un fichier déposé. UTF-8 d'abord ; si le résultat
 * contient des caractères de remplacement, on retente en Windows-1252 —
 * l'encodage par défaut d'« Enregistrer sous CSV » sur Excel Windows français,
 * qui sinon transforme « Résidence » en « R?sidence ».
 */
export function decodeSpreadsheetBytes(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer)
  if (!utf8.includes("\uFFFD")) return utf8

  try {
    return new TextDecoder("windows-1252").decode(buffer)
  } catch {
    return utf8
  }
}
