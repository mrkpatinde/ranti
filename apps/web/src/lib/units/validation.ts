import { UNIT_TYPES, type UnitType } from "./types"

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null

  const text = value.trim().replace(/\s+/g, " ")

  if (!text) return null
  if (text.length > maxLength) return null

  return text
}

export function normalizeUnitName(value: FormDataEntryValue | null) {
  const name = normalizeText(value, 80)

  if (!name || name.length < 1) return null

  return name
}

export function normalizeUnitType(value: FormDataEntryValue | null): UnitType | null {
  if (typeof value !== "string") return null

  return (UNIT_TYPES as readonly string[]).includes(value) ? (value as UnitType) : null
}

export function normalizeOptionalUnitText(
  value: FormDataEntryValue | null,
  maxLength: number
) {
  return normalizeText(value, maxLength)
}

// Loyer par défaut du logement (FCFA). Optionnel : null si non renseigné.
// Miroir de normalizeRentAmount (leases) — un défaut de saisie, pas le bail.
export function normalizeDefaultRent(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null
  const raw = value.replace(/\s/g, "")
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Jour d'échéance par défaut (1..31). null si absent/invalide.
export function normalizeDefaultDueDay(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

export type Availability = "available" | "occupied"

export function normalizeAvailability(value: FormDataEntryValue | null): Availability | null {
  return value === "available" || value === "occupied" ? value : null
}
