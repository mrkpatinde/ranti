import { formatFcfa } from "@/lib/format"

// Notification de charge « préparée sans envoi automatique » (même doctrine
// que buildReminderWaLink, ADR-006 MVP) : lien wa.me pré-rempli, le
// propriétaire relit et envoie. L'envoi automatisé est le rail ranti-ops
// (vue ops_ledger_notifications, contrat ADR-022 reconduit).

export interface ChargeNotice {
  /** Téléphone du locataire au format +229… */
  phone: string
  /** Nom du locataire, ou null. */
  tenantName: string | null
  /** Libellé de la charge (« Réparation serrure »). */
  label: string
  /** Montant (FCFA entier). */
  amount: number
  /** URL publique ABSOLUE de validation (/transaction/[token]). */
  actionUrl: string
}

// Construit le lien wa.me pré-rempli, ou null si le numéro est inexploitable.
export function buildChargeWaLink(input: ChargeNotice): string | null {
  const digits = input.phone.replace(/\D/g, "")
  if (!digits) return null

  const name = input.tenantName?.trim()
  const greeting = name ? `Bonjour ${name}, ` : "Bonjour, "

  const message =
    `${greeting}une somme a été ajoutée à votre compte loyer : ` +
    `${input.label} — ${formatFcfa(input.amount)}. ` +
    `Vous pouvez la valider ou signaler une erreur ici : ${input.actionUrl}`

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
