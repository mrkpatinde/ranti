// Annonce du relevé au mandant. Ranti n'envoie rien : on prépare un lien
// wa.me pré-rempli que le gestionnaire ouvre depuis son propre WhatsApp
// (même mécanisme que lib/reminders/whatsapp.ts). Le relevé lui-même (PDF)
// est joint par le gestionnaire.

import { formatFcfa } from "@/lib/format"
import { buildWaLink } from "@/lib/reminders/whatsapp"
import { monthLabel } from "./month"

export type StatementNotice = {
  /** Téléphone du mandant, ou null s'il n'en a pas. */
  phone: string | null
  ownerName: string
  /** Mois « YYYY-MM ». */
  month: string
  collected: number
  fee: number
  net: number
}

export function buildStatementMessage(input: Omit<StatementNotice, "phone">): string {
  const name = input.ownerName.trim()
  const greeting = name ? `Bonjour ${name}, ` : "Bonjour, "
  const period = monthLabel(input.month)

  if (input.collected <= 0) {
    return `${greeting}relevé de gestion de ${period} : aucun encaissement sur la période. Le relevé détaillé suit.`
  }

  return (
    `${greeting}relevé de gestion de ${period} : ${formatFcfa(input.collected)} encaissés, ` +
    `${formatFcfa(input.fee)} d'honoraires, ${formatFcfa(input.net)} à vous reverser. ` +
    `Le relevé détaillé suit.`
  )
}

/** Lien wa.me pré-rempli, ou null si le mandant n'a pas de numéro exploitable. */
export function buildStatementWaLink(input: StatementNotice): string | null {
  return buildWaLink(input.phone, buildStatementMessage(input))
}
