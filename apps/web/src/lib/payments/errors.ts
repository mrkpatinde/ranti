// ADR-018 — Messages utilisateur FR pour les erreurs du domaine payments.
// Même pattern que collectionErrorMessage (src/lib/collections/actions.ts) :
// les RPC lèvent des codes snake_case, on mappe par correspondance.

import type { PaymentErrorCode } from "./types"

const MESSAGES: Record<PaymentErrorCode, string> = {
  lease_not_found: "Bail introuvable.",
  lease_not_active: "Ce bail n'est pas actif.",
  amount_invalid: "Indiquez un montant valide.",
  payment_amount_mismatch: "Le montant ne correspond pas au loyer du bail.",
  transaction_not_found: "Transaction introuvable.",
  transaction_not_pending: "Cette transaction a déjà été traitée.",
  provider_invalid: "Fournisseur de paiement inconnu.",
  payout_not_applicable: "Reversement impossible pour cette transaction.",
  invalid_body: "Requête invalide.",
  technical: "Opération impossible. Réessayez.",
}

export function paymentErrorMessage(code: PaymentErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.technical
}

/** Traduit un message d'erreur RPC (substring) en code du domaine. */
export function paymentErrorCodeFromMessage(message: string): PaymentErrorCode {
  if (message.includes("lease_not_found")) return "lease_not_found"
  if (message.includes("lease_not_active")) return "lease_not_active"
  if (message.includes("amount_invalid")) return "amount_invalid"
  if (message.includes("amount_mismatch")) return "payment_amount_mismatch"
  if (message.includes("transaction_not_found")) return "transaction_not_found"
  if (message.includes("transaction_not_pending")) return "transaction_not_pending"
  if (message.includes("provider_invalid")) return "provider_invalid"
  if (message.includes("payout_not_applicable")) return "payout_not_applicable"
  if (message.includes("invalid_body")) return "invalid_body"
  return "technical"
}
