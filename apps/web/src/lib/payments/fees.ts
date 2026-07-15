// ADR-018 v4 — Modèle économique « All-Inclusive 5 % ».
//
// Module PUR (zéro import métier, zéro I/O) : miroir exact de la fonction SQL
// private.compute_transaction_details (migration all_inclusive_5pct).
// La base fait autorité (contraintes CHECK) ; ce module sert à l'affichage
// et aux pré-vérifications côté serveur. Ne jamais l'utiliser côté client
// pour un montant faisant foi.
//
// Deux visions sur chaque transaction :
//   * REÇU (propriétaire) : rantiServiceFee = 5 % du brut, tout compris ;
//     netToLandlord = brut − rantiServiceFee (95 %).
//   * COMPTABILITÉ (interne) : les frais PSP sont des DÉPENSES de Ranti,
//     invisibles du propriétaire — payinCost sur le brut, payoutCost sur le
//     NET (le payout porte sur le montant effectivement reversé),
//     netRantiMargin = rantiServiceFee − payinCost − payoutCost.
//     netRantiMargin peut être négatif si les coûts dépassent la commission :
//     c'est une information de pilotage, pas une erreur.
//
// Entiers FCFA uniquement — jamais de flottants ; floor par composant,
// net par soustraction → chaque vision balance par construction.
// Taux en basis points archivés sur chaque ligne du ledger : changer de PSP
// ou renégocier ne casse ni l'historique ni les CHECKs.

import { PaymentError } from "./types"

/** Taux en basis points (1 bp = 0,01 %). Défauts : 5 % service, coûts FeexPay
 *  (payin 170 bp, payout 100 bp — décision CEO 2026-07-14, à verrouiller au
 *  contrat PSP). */
export const TRANSACTION_RATES_BP = {
  service: 500,
  payin: 170,
  payout: 100,
} as const

export interface TransactionRatesBp {
  service: number
  payin: number
  payout: number
}

export interface TransactionDetails {
  /** Montant brut payé par le locataire (FCFA entier). */
  grossAmount: number

  // ── Vision REÇU (montrée au propriétaire) ─────────────────────────────────
  /** Commission Ranti tout compris (5 % du brut par défaut). */
  rantiServiceFee: number
  /** Ce qui est reversé au propriétaire : grossAmount − rantiServiceFee. */
  netToLandlord: number

  // ── Vision COMPTABILITÉ (interne, jamais montrée au propriétaire) ─────────
  /** Coût PSP d'encaissement, sur le brut. */
  payinCost: number
  /** Coût PSP de reversement, sur le NET reversé. */
  payoutCost: number
  /** Rentabilité réelle : rantiServiceFee − payinCost − payoutCost. */
  netRantiMargin: number

  serviceFeeBp: number
  payinCostBp: number
  payoutCostBp: number
}

function feeFor(amount: number, bp: number): number {
  return Math.floor((amount * bp) / 10000)
}

/**
 * Calcule les deux visions pour un montant XOF entier positif.
 * Lève PaymentError("amount_invalid") sinon — mêmes règles que la RPC.
 */
export function calculateTransactionDetails(
  grossAmount: number,
  rates: TransactionRatesBp = TRANSACTION_RATES_BP,
): TransactionDetails {
  if (!Number.isInteger(grossAmount) || grossAmount <= 0) {
    throw new PaymentError("amount_invalid")
  }
  if (
    !Number.isInteger(rates.service) ||
    !Number.isInteger(rates.payin) ||
    !Number.isInteger(rates.payout) ||
    rates.service < 0 ||
    rates.payin < 0 ||
    rates.payout < 0
  ) {
    throw new PaymentError("amount_invalid")
  }

  const rantiServiceFee = feeFor(grossAmount, rates.service)
  const netToLandlord = grossAmount - rantiServiceFee
  const payinCost = feeFor(grossAmount, rates.payin)
  const payoutCost = feeFor(netToLandlord, rates.payout)

  return {
    grossAmount,
    rantiServiceFee,
    netToLandlord,
    payinCost,
    payoutCost,
    netRantiMargin: rantiServiceFee - payinCost - payoutCost,
    serviceFeeBp: rates.service,
    payinCostBp: rates.payin,
    payoutCostBp: rates.payout,
  }
}
