import { formatFcfa } from "@/lib/format"
import { amountInWordsFcfa } from "@/lib/amount-words"
import type { ReceiptKind } from "./types"

// Clause notariale de la quittance/reçu, partagée par la page locataire
// (/recu/[token]), le PDF et la modale FirstRun. La formulation s'adapte : une
// quittance solde la période, un reçu constate un paiement partiel. Le montant
// est repris en chiffres ET en toutes lettres (preuve, moindre ambiguïté).
export function receiptClause(opts: {
  landlordName: string
  tenantName: string
  amount: number
  kind: ReceiptKind
}): string {
  const closing =
    opts.kind === "quittance"
      ? "dont quittance pour solde de ladite période."
      : "à titre de paiement partiel du loyer de ladite période."
  return `Je soussigné(e) ${opts.landlordName}, propriétaire, reconnais avoir reçu de ${opts.tenantName} la somme de ${formatFcfa(opts.amount)} (${amountInWordsFcfa(opts.amount)}), ${closing}`
}
