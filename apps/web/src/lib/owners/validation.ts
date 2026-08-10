// Saisie et affichage du mandant. Règle d'interface : le taux d'honoraires se
// saisit et se lit en POURCENTAGE (8,5). Les points de base sont un détail de
// stockage, ils ne sortent jamais à l'écran.

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null

  const text = value.trim().replace(/\s+/g, " ")

  if (!text) return null
  if (text.length > maxLength) return null

  return text
}

export function normalizeOwnerName(value: FormDataEntryValue | null) {
  const name = normalizeText(value, 120)

  if (!name || name.length < 2) return null

  return name
}

export function normalizeOptionalOwnerText(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  return normalizeText(value, maxLength)
}

// Le mandant n'est pas relancé par WhatsApp : son numéro est un simple contact,
// il peut être étranger. On ne lui applique donc pas le plan de numérotation
// béninois exigé des locataires.
export function normalizeOwnerPhone(value: FormDataEntryValue | null) {
  return normalizeText(value, 32)
}

const NBSP = "\u00a0"

/**
 * « 8,5 » → 850 points de base. Vide → 0 (aucun honoraire). null = saisie
 * invalide, à signaler. Arrondi à la décimale : c'est la précision affichée.
 */
export function parseFeePercent(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null

  const raw = value.trim().replace(/\s/g, "").replace("%", "").replace(",", ".")
  if (raw === "") return 0

  if (!/^\d+(\.\d+)?$/.test(raw)) return null

  const percent = Number.parseFloat(raw)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null

  return Math.round(percent * 10) * 10
}

/** 850 → « 8,5 % » (espace insécable, comme les montants). */
export function formatFeeRate(basisPoints: number): string {
  return `${feeRateInputValue(basisPoints)}${NBSP}%`
}

/** 850 → « 8,5 », 800 → « 8 » : la valeur telle qu'on la saisit. */
export function feeRateInputValue(basisPoints: number): string {
  const safe = Number.isFinite(basisPoints) ? Math.max(0, Math.trunc(basisPoints)) : 0
  const percent = Math.round(safe) / 100

  return percent.toFixed(1).replace(/\.0$/, "").replace(".", ",")
}
