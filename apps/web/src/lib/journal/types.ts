// Journal de bord (ADR-014) : projection en lecture de la vue journal_feed.
// Un événement = une ligne de n'importe quelle table métier, unifiée.

export type JournalEventType =
  | "lease_started"
  | "rent_due"
  | "rent_reception"
  | "receipt"
  | "reminder"

export interface JournalEvent {
  event_type: JournalEventType
  /** ISO timestamp, tri décroissant côté requête. */
  occurred_at: string
  /** Libellé humain déjà en français (ex. « Encaissement non affecté »). */
  label: string
  /** Montant en FCFA (entier) ou null (ex. relance). */
  amount: number | null
  currency: string | null
  /** Table source + id, pour le lien vers le détail. */
  ref_table: string
  ref_id: string
  /** Locataire concerné, ou null. */
  counterparty: string | null
  /** Téléphone du locataire (+229…), pour le lien wa.me sortant, ou null. */
  counterparty_phone: string | null
  /** Logement concerné, ou null. */
  unit_label: string | null
  /** Référence d'opérateur (encaissement SMS), ou null. */
  reference: string | null
  /** Encaissement : true = affecté à une échéance, false = Fast-Log non alloué. */
  allocated: boolean | null
  /** Token du reçu émis, pour le lien public /recu/[token] (ADR-013), ou null. */
  receipt_token: string | null
}
