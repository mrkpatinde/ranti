// Montant en toutes lettres (français), pour les quittances/reçus. Les montants
// FCFA sont entiers (pas de centimes). Orthographe traditionnelle : traits
// d'union dans les groupes < 100, « et » pour 21/31/.../71, « cent » et
// « quatre-vingt » s'accordent au pluriel seulement en fin de nombre ou devant
// un nom-multiplicateur (million/milliard), jamais devant « mille ».

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
]
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"]

// 0..99. `last` = rien ne suit ce groupe dans le nombre entier (pour le « s »
// de « quatre-vingts »).
function twoDigits(n: number, last: boolean): string {
  if (n < 20) return UNITS[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7 || t === 9) {
    const base = t === 7 ? "soixante" : "quatre-vingt"
    if (t === 7 && u === 1) return "soixante et onze"
    return `${base}-${UNITS[10 + u]}`
  }
  const tens = t === 8 ? "quatre-vingt" : TENS[t]
  if (u === 0) return t === 8 && last ? "quatre-vingts" : tens
  if (u === 1 && t !== 8) return `${tens} et un`
  return `${tens}-${UNITS[u]}`
}

// 0..999. `centCanPlural` = « cent » peut prendre un « s » (faux devant « mille »).
function threeDigits(n: number, last: boolean, centCanPlural: boolean): string {
  if (n < 100) return twoDigits(n, last)
  const h = Math.floor(n / 100)
  const rem = n % 100
  const hundred = h === 1 ? "cent" : `${UNITS[h]} cent`
  if (rem === 0) return h > 1 && centCanPlural ? `${hundred}s` : hundred
  return `${hundred} ${twoDigits(rem, last)}`
}

// Entier positif -> mots. « mille » invariable ; « million »/« milliard » nom
// (prennent « s » au pluriel).
export function integerToFrenchWords(value: number): string {
  const n = Math.max(0, Math.floor(value))
  if (n === 0) return "zéro"

  const parts: string[] = []
  const bil = Math.floor(n / 1_000_000_000)
  const mil = Math.floor((n % 1_000_000_000) / 1_000_000)
  const mille = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000

  if (bil) parts.push(`${bil === 1 ? "un" : threeDigits(bil, false, true)} milliard${bil > 1 ? "s" : ""}`)
  if (mil) parts.push(`${mil === 1 ? "un" : threeDigits(mil, false, true)} million${mil > 1 ? "s" : ""}`)
  if (mille) parts.push(mille === 1 ? "mille" : `${threeDigits(mille, false, false)} mille`)
  if (rest) parts.push(threeDigits(rest, true, true))

  return parts.join(" ")
}

// Montant FCFA en toutes lettres, ex. 100000 -> « cent mille francs CFA ».
export function amountInWordsFcfa(amount: number): string {
  const n = Math.max(0, Math.floor(amount))
  // « zéro franc » et « un franc » au singulier ; pluriel à partir de deux.
  return `${integerToFrenchWords(n)} ${n <= 1 ? "franc" : "francs"} CFA`
}
