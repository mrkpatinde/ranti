// ADR-018 — Normalisation de la charge utile webhook Kkiapay.
// Narrowing manuel (style maison, pas de zod). Retourne null si la forme est
// invalide : la route répond alors 400 invalid_body.
//
// Forme attendue (posée par NOTRE checkout dans les métadonnées Kkiapay) :
//   { transactionId, amount, status, stateData: { lease_id } }
// Les clés alternatives courantes de Kkiapay (reference, state) sont tolérées.

import type { NormalizedKkiapayEvent } from "./types"

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

export function normalizeKkiapayPayload(
  json: unknown,
): NormalizedKkiapayEvent | null {
  if (!isRecord(json)) return null

  const reference =
    readNonEmptyString(json.transactionId) ?? readNonEmptyString(json.reference)
  const amount = readPositiveInt(json.amount)
  const providerStatus = readNonEmptyString(json.status) ?? "UNKNOWN"

  const stateData = isRecord(json.stateData)
    ? json.stateData
    : isRecord(json.state)
      ? json.state
      : null
  const leaseId = stateData ? readNonEmptyString(stateData.lease_id) : null

  if (!reference || !amount || !leaseId || !UUID_RE.test(leaseId)) return null

  return {
    reference,
    leaseId,
    amount,
    providerStatus,
    payload: json,
  }
}
