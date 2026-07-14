// ADR-018 — Vérification de signature webhook Kkiapay.
// HMAC-SHA256 du corps BRUT, comparaison à temps constant.
//
// ⚠️ Nom d'en-tête et encodage à confirmer sur la doc Kkiapay au moment du
// branchement sandbox (isolé ici : fix une ligne). Défaut : `x-kkiapay-signature`
// en hexadécimal.

import { createHmac, timingSafeEqual } from "node:crypto"

export const KKIAPAY_SIGNATURE_HEADER = "x-kkiapay-signature"

export function verifyKkiapaySignature(
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
