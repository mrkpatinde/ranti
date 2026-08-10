// Normalisation des valeurs lues dans le fichier de l'agence. La base attend
// des entiers, des dates ISO et des types de lot en anglais ; le fichier, lui,
// contient « 125 000 FCFA », « 01/03/2026 » et « Chambre ». On traduit ici, une
// fois, plutôt que de renvoyer l'agence corriger son Excel cellule par cellule.
//
// Règle constante : quand une valeur reste incompréhensible, on la laisse
// telle quelle — la validation SQL la signalera en clair sur sa ligne, ce qui
// vaut mieux qu'une valeur inventée.

const UNIT_TYPE_BY_LABEL: Record<string, string> = {
  // house
  maison: "house",
  villa: "house",
  duplex: "house",
  pavillon: "house",
  house: "house",
  // apartment
  appartement: "apartment",
  appart: "apartment",
  appt: "apartment",
  studio: "apartment",
  logement: "apartment",
  apartment: "apartment",
  f1: "apartment",
  f2: "apartment",
  f3: "apartment",
  f4: "apartment",
  // room
  chambre: "room",
  "chambre salon": "room",
  piece: "room",
  room: "room",
  // shop
  boutique: "shop",
  commerce: "shop",
  "local commercial": "shop",
  shop: "shop",
  // store
  magasin: "store",
  store: "store",
  // office
  bureau: "office",
  bureaux: "office",
  office: "office",
  // warehouse
  entrepot: "warehouse",
  hangar: "warehouse",
  depot: "warehouse",
  warehouse: "warehouse",
  // other
  autre: "other",
  other: "other",
}

// Minuscules, sans accent, ponctuation réduite à l'espace : « Bâtiment n°2 »
// et « batiment n 2 » deviennent la même chaîne.
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function hasDigit(value: string): boolean {
  return /\d/.test(value)
}

/**
 * « 125 000 FCFA » → « 125000 », « 1.250.000 » → « 1250000 »,
 * « 50000,00 » → « 50000 ». Le franc CFA n'a pas de centime : un groupe final
 * de 1 ou 2 chiffres après un séparateur est une décimale, on la coupe ; un
 * groupe de 3 chiffres est un séparateur de milliers.
 */
export function normalizeAmountText(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (!hasDigit(value)) return value

  const cleaned = value.replace(/[^\d.,-]/g, "")
  const negative = cleaned.startsWith("-")
  const digitsAndSeps = cleaned.replace(/-/g, "")

  const lastSeparator = Math.max(digitsAndSeps.lastIndexOf("."), digitsAndSeps.lastIndexOf(","))
  let whole = digitsAndSeps

  if (lastSeparator >= 0) {
    const tail = digitsAndSeps.slice(lastSeparator + 1)
    // Décimale (1 ou 2 chiffres) : tronquée, le registre est en entiers.
    whole = tail.length > 0 && tail.length <= 2 ? digitsAndSeps.slice(0, lastSeparator) : digitsAndSeps
  }

  const digits = whole.replace(/[^\d]/g, "")
  if (!digits) return value

  return `${negative ? "-" : ""}${digits.replace(/^0+(?=\d)/, "")}`
}

/**
 * Jour d'échéance : « le 5 » → « 5 ». Une valeur sans chiffre est conservée
 * pour que la validation la signale.
 */
export function normalizeDueDayText(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  const digits = value.match(/\d+/)
  return digits ? String(Number.parseInt(digits[0], 10)) : value
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

/**
 * Dates du fichier → ISO. On lit en jour/mois/année (contexte francophone) :
 * « 01/03/2026 » est le 1er mars, jamais le 3 janvier. Une date déjà ISO passe
 * telle quelle, une date illisible est conservée pour être signalée.
 */
export function normalizeDateText(raw: string): string {
  const value = raw.trim()
  if (!value) return ""

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (iso) {
    const month = Number.parseInt(iso[2], 10)
    const day = Number.parseInt(iso[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${iso[1]}-${pad2(month)}-${pad2(day)}`
    }
    return value
  }

  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (dmy) {
    const day = Number.parseInt(dmy[1], 10)
    const month = Number.parseInt(dmy[2], 10)
    const yearRaw = Number.parseInt(dmy[3], 10)
    const year = dmy[3].length === 2 ? 2000 + yearRaw : yearRaw
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
    return value
  }

  return value
}

/**
 * « Chambre » → « room ». Un libellé non reconnu devient « other » : le type
 * de lot est une étiquette, il ne doit pas bloquer l'import d'un portefeuille.
 */
export function normalizeUnitTypeText(raw: string): string {
  const label = normalizeLabel(raw)
  if (!label) return ""
  return UNIT_TYPE_BY_LABEL[label] ?? "other"
}

/**
 * Taux d'honoraires saisi en pourcentage dans le fichier (« 8,5 », « 8,5 % »)
 * → points de base attendus par la base (850). Arrondi à la décimale, comme
 * dans les formulaires mandant.
 */
export function feePercentToBasisPoints(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (!hasDigit(value)) return value

  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".")
  const percent = Number.parseFloat(cleaned)
  if (!Number.isFinite(percent) || percent < 0) return value

  return String(Math.round(percent * 10) * 10)
}

/**
 * Téléphone du locataire → format international compact, celui qu'attendent
 * les relances (le lien wa.me ne garde que les chiffres : « 01 90 00 00 00 »
 * sans indicatif n'aboutirait nulle part). On ne convertit que ce qui est
 * certain — numéro béninois à 10 chiffres, forme +229, forme 00229 ; tout le
 * reste est simplement compacté, un mandant peut avoir un locataire étranger.
 */
export function normalizePhoneText(raw: string): string {
  const value = raw.trim()
  if (!value) return ""

  const compact = value.replace(/[\s\u00a0().-]/g, "")
  if (compact.startsWith("+")) return compact
  if (compact.startsWith("00")) return `+${compact.slice(2)}`

  const digits = compact.replace(/\D/g, "")
  if (/^229\d{10}$/.test(digits)) return `+${digits}`
  if (/^01\d{8}$/.test(digits)) return `+229${digits}`

  return compact
}

/** Devise : « fcfa » et « f cfa » désignent le XOF du registre. */
export function normalizeCurrencyText(raw: string): string {
  const label = normalizeLabel(raw)
  if (!label) return ""
  if (label === "fcfa" || label === "f cfa" || label === "cfa" || label === "franc cfa") {
    return "XOF"
  }
  return raw.trim().toUpperCase()
}

/**
 * Un fichier n'a souvent qu'une colonne « Locataire » contenant le nom complet.
 * La table tenants exige un prénom ET un nom : on coupe au premier espace,
 * premier mot = prénom, le reste = nom. Un nom d'un seul mot n'est pas coupé —
 * la ligne est alors signalée à l'aperçu plutôt que devinée.
 */
export function splitFullName(fullName: string): { first: string; last: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { first: parts[0], last: parts.slice(1).join(" ") }
}
