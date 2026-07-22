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
   * Nom du propriétaire, fourni UNIQUEMENT au tout premier message envoyé à ce
   * locataire : Ranti se présente et explique le processus avant le rappel
   * (décision 2026-07-18). null/absent = locataire déjà contacté.
   */
  introFrom?: string | null
}

// Présentation de Ranti au tout premier contact : qui parle, pour qui, et la
// règle d'or non-custodiale (les paiements restent directs).
export function buildFirstContactIntro(landlordName: string): string {
  return (
    `Je suis Ranti, le registre de loyer qu'utilise ${landlordName} pour tenir ` +
    `vos quittances. Je vous transmets ses rappels et vos quittances à ` +
    `confirmer. Vos paiements restent directs entre vous et votre ` +
    `propriétaire : Ranti ne touche jamais l'argent. `
  )
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

// Texte du message de relance par défaut (rappel ou retard). Exporté seul pour
// que l'aperçu montré au propriétaire (/reminders) soit EXACTEMENT le message
// préparé, jamais une paraphrase.
export function buildReminderMessage(input: Omit<ReminderNotice, "phone">): string {
  const name = input.tenantName?.trim()
  const intro = input.introFrom ? buildFirstContactIntro(input.introFrom) : ""
  const greeting = (name ? `Bonjour ${name}, ` : "Bonjour, ") + intro
  const montant = formatFcfa(input.amount)

  return input.late
    ? `${greeting}votre loyer de ${montant} (${frMonth(input.dueDate)}) est en retard. Merci de régulariser.`
    : `${greeting}petit rappel : votre loyer de ${montant} arrive à échéance le ${frDate(input.dueDate)}. Merci.`
}

// Construit le lien wa.me pré-rempli, ou null si le numéro est inexploitable.
export function buildReminderWaLink(input: ReminderNotice): string | null {
  // wa.me attend l'indicatif pays + numéro, sans « + » ni séparateur.
  const digits = input.phone.replace(/\D/g, "")
  if (!digits) return null

  return `https://wa.me/${digits}?text=${encodeURIComponent(buildReminderMessage(input))}`
}
