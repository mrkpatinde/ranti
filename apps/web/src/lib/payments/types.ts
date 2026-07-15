// ADR-018 v2 — Types du domaine payments (cœur transactionnel Kkiapay).

export type PaymentTransactionStatus =
  | "pending"
  | "verified"
  | "paid_out"
  | "rejected"

export type PaymentProvider = "fedapay" | "feexpay" | "kkiapay"

/** Ligne du ledger public.payment_transactions (montants FCFA entiers). */
export interface PaymentTransaction {
  id: string
  landlord_id: string
  lease_id: string
  provider: PaymentProvider
  provider_reference: string
  amount_received: number
  /** Vision reçu : commission tout compris (5 % défaut) + net reversé.
   *  Les colonnes de la vision comptabilité (payin_cost, payout_cost,
   *  net_margin) sont invisibles pour authenticated — grants par colonne ;
   *  voir LedgerAccountingRow pour la lecture interne en service_role. */
  service_fee_bp: number
  service_fee: number
  net_amount: number
  currency: "XOF"
  status: PaymentTransactionStatus
  rejection_reason: string | null
  rent_reception_id: string | null
  created_at: string
  verified_at: string | null
  paid_out_at: string | null
}

/** Vision comptabilité interne (lecture service_role UNIQUEMENT — les grants
 *  par colonne cachent ces champs au propriétaire). Suivi de rentabilité
 *  réelle : net_margin = service_fee − payin_cost − payout_cost. */
export interface LedgerAccountingRow extends PaymentTransaction {
  payin_cost_bp: number
  payout_cost_bp: number
  payin_cost: number
  payout_cost: number
  net_margin: number
}

// Codes levés par les RPC (P0001/P0002, message = code) ou par la couche TS.
// Convention unique : snake_case minuscule (cf. table ADR-018 / plan).
export type PaymentErrorCode =
  | "lease_not_found"
  | "lease_not_active"
  | "amount_invalid"
  | "payment_amount_mismatch"
  | "transaction_not_found"
  | "transaction_not_pending"
  | "provider_invalid"
  | "payout_not_applicable"
  | "invalid_body"
  | "technical"

export class PaymentError extends Error {
  readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, message?: string) {
    super(message ?? code)
    this.name = "PaymentError"
    this.code = code
  }
}

/** Événement webhook Kkiapay normalisé (validation.ts). */
export interface NormalizedKkiapayEvent {
  /** Référence de transaction Kkiapay — clé d'idempotence. */
  reference: string
  /** Bail visé, posé dans les métadonnées au moment du checkout. */
  leaseId: string
  /** Montant brut payé (FCFA entier). */
  amount: number
  /** Statut brut annoncé par Kkiapay (ex. SUCCESS). */
  providerStatus: string
  /** Charge utile brute normalisée, archivée dans payment_transactions.payload. */
  payload: Record<string, unknown>
}

export interface IngestResult {
  transactionId: string
  status: PaymentTransactionStatus
  created: boolean
}

// Résultat du traitement webhook : le webhook INGÈRE seulement (ADR-017) —
// 'pending' attend la validation du propriétaire.
export type ProcessPaymentResult =
  | { outcome: "pending"; transactionId: string }
  | { outcome: "rejected"; transactionId: string }
  | { outcome: "duplicate"; transactionId: string; status: PaymentTransactionStatus }
