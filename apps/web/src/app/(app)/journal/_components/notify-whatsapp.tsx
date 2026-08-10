"use client"

import { useState } from "react"
import { buildTenantPaymentWaLink } from "@/lib/journal/whatsapp"
import { requestReceiptShareToken } from "@/lib/receipts/actions"

// Notification WhatsApp sortante depuis le journal (ADR-014, étape 6).
// Le lien /recu/[token] ne se lit plus dans journal_feed : le jeton s'obtient
// AU CLIC via la RPC journalisée receipt_share_token (migration
// 20260809120300) — chaque remise du lien locataire laisse une trace d'audit,
// au lieu d'être servie en masse à chaque affichage du journal.
export function NotifyWhatsApp({
  phone,
  tenantName,
  amount,
  receiptId,
  origin,
}: {
  phone: string
  tenantName: string | null
  amount: number
  /** Id de la quittance émise, ou null si aucun reçu n'existe encore. */
  receiptId: string | null
  origin?: string
}): React.JSX.Element {
  const [pending, setPending] = useState(false)

  async function notify(): Promise<void> {
    if (pending) return
    setPending(true)
    try {
      const base = origin ?? window.location.origin
      const token = receiptId ? await requestReceiptShareToken(receiptId) : null
      const link = buildTenantPaymentWaLink({
        phone,
        tenantName,
        amount,
        receiptUrl: token ? `${base}/recu/${token}` : null,
      })
      if (link) window.open(link, "_blank", "noopener,noreferrer")
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={notify}
      disabled={pending}
      className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
      aria-label="Notifier le locataire du paiement reçu sur WhatsApp"
    >
      {pending ? "Préparation…" : "Notifier sur WhatsApp"}
    </button>
  )
}
