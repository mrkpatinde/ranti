import { formatFcfa } from "@/lib/format"

// Notification WhatsApp sortante depuis le journal (ADR-014, étape 6).
// On ne génère qu'un lien profond wa.me ouvert dans l'app WhatsApp native du
// propriétaire : zéro API de diffusion, donc aucun coût ni risque de
// bannissement. Le message affiche UNIQUEMENT le montant net reçu — aucune
// mention de charges (eau, électricité), par choix produit.

export interface TenantPaymentNotice {
  /** Téléphone du locataire au format +229… (depuis journal_feed). */
  phone: string
  /** Nom du locataire, ou null. */
  tenantName: string | null
  /** Montant net reçu en FCFA (entier). */
  amount: number
  /**
   * URL publique ABSOLUE du reçu partagé (/recu/[token], ADR-013) : le locataire
   * y confirme l'exactitude du reçu et télécharge le PDF. Absente si aucun reçu
   * n'a encore été émis pour cet encaissement.
   */
  receiptUrl?: string | null
}

// Construit le lien wa.me pré-rempli, ou null si le numéro est inexploitable.
export function buildTenantPaymentWaLink(input: TenantPaymentNotice): string | null {
  // wa.me attend l'indicatif pays + numéro, sans « + » ni séparateur.
  const digits = input.phone.replace(/\D/g, "")
  if (!digits) return null

  const name = input.tenantName?.trim()
  const greeting = name ? `Bonjour ${name}, ` : "Bonjour, "
  const receiptUrl = input.receiptUrl?.trim()

  // Le message porte le lien de confirmation : sans lui, le locataire ne peut ni
  // confirmer le reçu (deuxième voix) ni télécharger sa quittance en PDF.
  const proof = receiptUrl
    ? ` Confirmez votre reçu et téléchargez-le en PDF ici : ${receiptUrl}`
    : ""

  const message = `${greeting}nous confirmons la réception de votre paiement de ${formatFcfa(
    input.amount,
  )}.${proof} Merci.`

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
