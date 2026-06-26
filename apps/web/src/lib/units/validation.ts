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
