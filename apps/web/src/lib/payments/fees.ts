// ADR-018 v3 — Calcul des frais du cœur transactionnel (cash-out propriétaire).
//
// Module PUR (zéro import métier, zéro I/O) : miroir exact de la fonction SQL
// private.compute_payment_fees (migration payment_transactions_ledger).
// La base fait autorité (contraintes CHECK) ; ce module sert à l'affichage
// et aux pré-vérifications côté serveur. Ne jamais l'utiliser côté client
// pour un montant faisant foi.
//
// Règle métier :
//   * Cash-in : le locataire paie exactement 100 % du loyer via le PSP.
//   * Frais : 3,0 % total = PSP (180 bp défaut, reco FedaPay) + Ranti (120 bp).
//     Taux archivés sur chaque ligne du ledger — configurables sans casser
//     l'historique ; à verrouiller au contrat PSP.
//   * Cash-out : netPayout = grossAmount − pspFee − platformFee (97 %).
//     Entiers FCFA uniquement — jamais de flottants ; floor par composant,
//     net par soustraction → la somme balance par construction.

import { PaymentError } from "./types"

/** Taux en basis points (1 bp = 0,01 %). 180 + 120 = 3,0 % au total. */
export const FEE_RATES_BP = {
  psp: 180,
  platform: 120,
} as const

export interface FeeRatesBp {
  psp: number
  platform: number
}

export interface PayoutBreakdown {
  /** Montant brut payé par le locataire (FCFA entier). */
  grossAmount: number
  /** Frais du PSP (FCFA entier). */
  pspFee: number
  /** Commission Ranti (FCFA entier). */
  platformFee: number
  /** Ce qui est reversé au propriétaire : grossAmount − pspFee − platformFee. */
  netPayout: number
  pspFeeBp: number
  platformFeeBp: number
}

function feeFor(amount: number, bp: number): number {
  return Math.floor((amount * bp) / 10000)
}

/**
 * Calcule le reversement pour un montant XOF entier positif.
 * Lève PaymentError("amount_invalid") sinon — mêmes règles que la RPC.
 */
export function calculatePayout(
  amount: number,
  rates: FeeRatesBp = FEE_RATES_BP,
): PayoutBreakdown {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new PaymentError("amount_invalid")
  }
  if (
    !Number.isInteger(rates.psp) ||
    !Number.isInteger(rates.platform) ||
    rates.psp < 0 ||
    rates.platform < 0
  ) {
    throw new PaymentError("amount_invalid")
  }

  const pspFee = feeFor(amount, rates.psp)
  const platformFee = feeFor(amount, rates.platform)

  return {
    grossAmount: amount,
    pspFee,
    platformFee,
    netPayout: amount - pspFee - platformFee,
    pspFeeBp: rates.psp,
    platformFeeBp: rates.platform,
  }
}
