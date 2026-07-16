// ADR-019 — Types du client FeexPay (rail unique).
//
// Ces types décrivent NOTRE contrat avec l'API FeexPay (entrées/sorties des
// appels checkout & payout) et l'événement webhook normalisé. Les champs bruts
// renvoyés par FeexPay restent dans `raw` : le domaine payments ne dépend
// jamais de la forme exacte du PSP (isolation ADR-018/ADR-019).

/** Réseaux Mobile Money supportés au Bénin (rail de réception du payout).
 *  ⚠️ Valeurs exactes attendues par FeexPay à confirmer sur le sandbox. */
export type FeexpayNetwork = "MTN" | "MOOV" | "CELTIIS"

/** Statut brut d'une transaction FeexPay, normalisé en majuscules.
 *  FeexPay V2 : un payout démarre `PENDING` puis se résout par polling. */
export type FeexpayTransactionStatus =
  | "PENDING"
  | "SUCCESSFUL"
  | "FAILED"
  | "UNKNOWN"

// ── Cash-in (checkout locataire, montant PLEIN du loyer) ────────────────────

export interface FeexpayCheckoutInput {
  /** Bail visé — posé dans les métadonnées, relu au webhook (idempotence). */
  leaseId: string
  /** Montant plein du loyer en XOF entier (ADR-019 : zéro surcharge locataire). */
  amount: number
  /** Numéro payeur au format attendu par FeexPay (à confirmer : local vs E.164). */
  payerPhone?: string
  /** Description courte (« exigence BCEAO » côté PSP) — libellé de la quittance. */
  description?: string
}

export interface FeexpayCheckoutResult {
  /** Référence de transaction FeexPay — clé d'idempotence du ledger. */
  reference: string
  /** URL de checkout hébergé à ouvrir côté locataire (si applicable). */
  checkoutUrl: string | null
  status: FeexpayTransactionStatus
  /** Charge utile brute renvoyée par FeexPay (archive/debug). */
  raw: Record<string, unknown>
}

// ── Payout (reversement du NET au propriétaire, API FeexPay) ─────────────────

export interface FeexpayPayoutInput {
  /** Transaction du ledger reversée (traçabilité ops ↔ FeexPay). */
  transactionId: string
  /** Montant NET reversé en XOF entier (95 % — cf. calculateTransactionDetails). */
  amount: number
  /** Rail de réception défini par le propriétaire. */
  network: FeexpayNetwork
  /** Numéro de réception du propriétaire (MoMo/Moov/Celtiis). */
  recipientPhone: string
  /** Référence marchand idempotente côté FeexPay (anti double-payout). */
  merchantReference: string
}

export interface FeexpayPayoutResult {
  /** Référence du payout FeexPay (à poller jusqu'à résolution). */
  reference: string
  /** V2 : démarre presque toujours `PENDING`. */
  status: FeexpayTransactionStatus
  raw: Record<string, unknown>
}

export interface FeexpayStatusResult {
  reference: string
  status: FeexpayTransactionStatus
  raw: Record<string, unknown>
}

// ── Webhook normalisé (consommé par la route /api/payments/notification) ─────

export interface NormalizedFeexpayEvent {
  /** Référence de transaction FeexPay — clé d'idempotence. */
  reference: string
  /** Bail visé, posé dans les métadonnées au moment du checkout. */
  leaseId: string
  /** Montant brut payé (XOF entier). */
  amount: number
  /** Statut brut annoncé par FeexPay (ex. SUCCESSFUL). */
  providerStatus: string
  /** Charge utile brute normalisée, archivée dans payment_transactions.payload. */
  payload: Record<string, unknown>
}
