import { formatFcfa } from "@/lib/format"

// Relance MVP « préparée sans envoi automatique » (ADR-006, nuance MVP) :
// on ne génère qu'un lien profond wa.me pré-rempli, ouvert dans l'app WhatsApp
// du propriétaire. Zéro API de diffusion → aucun coût, aucun risque de
// bannissement, aucun envoi automatique. Le propriétaire relit et envoie.
// Même mécanisme que buildTenantPaymentWaLink (journal, ADR-014).

export interface ReminderNotice {
  /** Téléphone du locataire au format +229… */
  phone: string
  /** Nom du locataire, ou null. */
  tenantName: string | null
  /** Montant restant dû (FCFA entier). */
  amount: number
  /** Date d'échéance (YYYY-MM-DD). */
  dueDate: string
  /** true si l'échéance est passée (relance de retard vs simple rappel). */
  late: boolean
  /**
   * URL publique ABSOLUE de confirmation (/confirmer/[token]) : le locataire y
   * déclare son paiement. Absente si l'échéance n'a pas de jeton.
   */
  confirmUrl?: string | null
}

function frDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function frMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  })
}

// Construit le lien wa.me pré-rempli, ou null si le numéro est inexploitable.
export function buildReminderWaLink(input: ReminderNotice): string | null {
  // wa.me attend l'indicatif pays + numéro, sans « + » ni séparateur.
  const digits = input.phone.replace(/\D/g, "")
  if (!digits) return null

  const name = input.tenantName?.trim()
  const greeting = name ? `Bonjour ${name}, ` : "Bonjour, "
  const montant = formatFcfa(input.amount)

  const confirmUrl = input.confirmUrl?.trim()
  const confirm = confirmUrl
    ? ` Vous pouvez confirmer votre paiement ici : ${confirmUrl}`
    : ""

  const message = input.late
    ? `${greeting}votre loyer de ${montant} (${frMonth(input.dueDate)}) est en retard.${confirm} Merci de régulariser.`
    : `${greeting}petit rappel : votre loyer de ${montant} arrive à échéance le ${frDate(input.dueDate)}.${confirm} Merci.`

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
