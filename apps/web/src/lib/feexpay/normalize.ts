// ADR-019 — Normalisation de la charge utile webhook FeexPay.
// Narrowing manuel (style maison, pas de zod) : renvoie `null` si la forme est
// invalide → la route répond 400 invalid_body. Miroir de normalizeKkiapayPayload.
//
// ⚠️ Forme attendue à CONFIRMER sur le sandbox FeexPay. Hypothèse (à ajuster
// d'une ligne) : { reference, amount, status, callback_info: { lease_id } }.
// Le `lease_id` est celui que NOTRE checkout pose dans les métadonnées.

import type { NormalizedFeexpayEvent } from "./types"

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function readNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function readPositiveInt(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeFeexpayPayload(
  json: unknown,
): NormalizedFeexpayEvent | null {
  if (!isRecord(json)) return null

  const reference =
    readNonEmptyString(json.reference) ??
    readNonEmptyString(json.transaction_id) ??
    readNonEmptyString(json.transactionId)
  const amount = readPositiveInt(json.amount)
  const providerStatus = readNonEmptyString(json.status) ?? "UNKNOWN"

  // Le bail est posé par notre checkout ; clés alternatives tolérées.
  const meta = isRecord(json.callback_info)
    ? json.callback_info
    : isRecord(json.metadata)
      ? json.metadata
      : isRecord(json.custom_data)
        ? json.custom_data
        : null
  const leaseId = meta ? readNonEmptyString(meta.lease_id) : null

  if (!reference || !amount || !leaseId || !UUID_RE.test(leaseId)) return null

  return {
    reference,
    leaseId,
    amount,
    providerStatus,
    payload: json,
  }
}
