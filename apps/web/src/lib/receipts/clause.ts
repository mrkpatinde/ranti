import { formatFcfa } from "@/lib/format"
import { amountInWordsFcfa } from "@/lib/amount-words"
import type { ReceiptKind } from "./types"

// Formule de quittance/reçu, partagée par la page locataire
// (/recu/[token]), le PDF, la page bailleur et la modale FirstRun. La
// formulation s'adapte : une quittance solde la période, un reçu constate un
// paiement partiel. Le montant est repris en chiffres ET en toutes lettres
// (preuve, moindre ambiguïté). Quand la période est connue, elle est nommée
// dans la clause elle-même (revue 2026-07-18 : « ladite période » sans
// antécédent quand la clause est lue seule, ex. PDF).
export function receiptClause(opts: {
  landlordName: string
  tenantName: string
  amount: number
  kind: ReceiptKind
  period?: string | null
}): string {
  const forRent = opts.period ? `au titre du loyer de ${opts.period}, ` : ""
  const closing =
    opts.kind === "quittance"
      ? `${forRent}dont quittance pour solde de ladite période.`
      : opts.period
        ? `à titre de paiement partiel du loyer de ${opts.period}.`
        : "à titre de paiement partiel du loyer de ladite période."
  return `Je soussigné(e) ${opts.landlordName}, propriétaire, reconnais avoir reçu de ${opts.tenantName} la somme de ${formatFcfa(opts.amount)} (${amountInWordsFcfa(opts.amount)}), ${closing}`
}
