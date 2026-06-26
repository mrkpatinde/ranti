function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null

  const text = value.trim().replace(/\s+/g, " ")

  if (!text) return null
  if (text.length > maxLength) return null

  return text
}

export function normalizePropertyName(value: FormDataEntryValue | null) {
  const name = normalizeText(value, 80)

  if (!name || name.length < 2) return null

  return name
}

export function normalizeOptionalPropertyText(
  value: FormDataEntryValue | null,
  maxLength: number
) {
  return normalizeText(value, maxLength)
}
