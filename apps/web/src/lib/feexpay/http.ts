// ADR-019 — Transport HTTP interne du client FeexPay.
// Un seul point d'entrée réseau : Authorization Bearer, JSON in/out, mapping
// des erreurs vers PaymentError("technical") — le domaine payments ne voit
// jamais un détail transport. SERVEUR UNIQUEMENT (porte la clé API).

import { PaymentError } from "@/lib/payments"
import type { FeexpayConfig } from "./config"

/** Coupe-circuit réseau : au-delà, on considère l'appel PSP en échec technique. */
const REQUEST_TIMEOUT_MS = 15_000

/** Statut brut FeexPay ramené à notre enum (majuscules, valeurs connues). */
export function normalizeStatus(raw: unknown): "PENDING" | "SUCCESSFUL" | "FAILED" | "UNKNOWN" {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : ""
  if (s === "PENDING") return "PENDING"
  if (s === "SUCCESSFUL" || s === "SUCCESS") return "SUCCESSFUL"
  if (s === "FAILED" || s === "FAILURE" || s === "DECLINED") return "FAILED"
  return "UNKNOWN"
}

/**
 * POST/GET JSON authentifié vers l'API FeexPay. Lève PaymentError("technical")
 * sur toute anomalie transport ou statut HTTP non-2xx (l'appelant décide de la
 * suite : retry ops, ligne ledger, etc.).
 */
export async function feexpayRequest(
  config: FeexpayConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    throw new PaymentError("technical", `feexpay: échec transport ${path} — ${String(err)}`)
  }

  const text = await response.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      throw new PaymentError("technical", `feexpay: réponse non-JSON ${path} (${response.status})`)
    }
  }

  if (!response.ok) {
    throw new PaymentError("technical", `feexpay: HTTP ${response.status} sur ${path}`)
  }

  return json && typeof json === "object" ? (json as Record<string, unknown>) : {}
}
