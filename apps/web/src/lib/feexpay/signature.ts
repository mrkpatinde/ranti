// ADR-019 — Vérification de signature webhook FeexPay.
// HMAC-SHA256 du corps BRUT, comparaison à temps constant (même contrat que
// verifyKkiapaySignature — le webhook porte sur les octets reçus, pas sur un
// JSON re-sérialisé).
//
// ⚠️ Nom d'en-tête et encodage à CONFIRMER sur la doc FeexPay au moment du
// branchement sandbox (isolé ici : fix une ligne). Défaut : `x-feexpay-signature`
// en hexadécimal.

import { createHmac, timingSafeEqual } from "node:crypto"

export const FEEXPAY_SIGNATURE_HEADER = "x-feexpay-signature"

export function verifyFeexpaySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest()
  const provided = Buffer.from(signatureHeader.trim().toLowerCase(), "hex")

  // Un en-tête non-hex ou tronqué produit un buffer plus court → rejet.
  if (provided.length !== expected.length) return false
  return timingSafeEqual(expected, provided)
}
