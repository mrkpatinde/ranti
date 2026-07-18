import { formatFcfa, formatFcfaNumber, MONTHS_FR } from "@/lib/format"

// Aides pures des actions FirstRun, extraites hors du module "use server"
// (qui ne peut exporter que des fonctions async) pour etre testables.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PAYMENT_METHOD_VALUES = new Set(["cash", "mobile_money", "bank_transfer", "other"])

export function validRequestId(value: string): string | null {
  return UUID_RE.test(value.trim()) ? value.trim() : null
}

// formatFcfa = seule source de vérité du format (U+00A0, cf. lib/format.ts) ;
// une devise autre que XOF garde son code tel quel.
export function fcfa(amount: number, currency: string): string {
  if (currency === "XOF") return formatFcfa(amount)
  return `${formatFcfaNumber(amount)} ${currency}`
}

// Meme table de correspondance que lib/onboarding/actions.ts::mapRpcError, mais
// pour une seule ligne (le flow guide ne cree qu'un bail a la fois).
export function mapBailError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "23505":
      return "Un logement porte deja ce nom dans ce lieu."
    case "23P01":
      return "Ce logement a deja un bail actif sur cette periode."
    case "23514":
      return "Valeur invalide (loyer ou jour d'echeance)."
    case "PR400":
      return "Renseignez le lieu : donnez-lui un nom (2 caracteres min.)."
    case "P0002":
      return "Lieu introuvable."
    case "P0001":
      return "Ajoutez au moins un logement."
    default:
      return "Enregistrement impossible. Verifiez les champs et reessayez."
  }
}

export function mapCollectionError(message: string): string {
  if (message.includes("DUPLICATE_PAYMENT")) return "Cet encaissement a deja ete enregistre."
  if (message.includes("allocations_exceed")) return "La somme allouee depasse le montant recu."
  if (message.includes("allocation_exceeds_due")) return "L'allocation depasse le reste du de l'echeance."
  if (message.includes("amount_invalid")) return "Indiquez un montant valide."
  if (message.includes("method_invalid")) return "Methode de paiement invalide."
  if (message.includes("due_")) return "L'echeance ne correspond pas a ce bail."
  return "Encaissement impossible. Reessayez."
}

// period_start = "YYYY-MM-DD" -> "juillet 2026" (pas de new Date pour eviter
// tout decalage de fuseau sur une date sans heure). Mois accentues partages
// (lib/format.ts).
export function monthLabel(isoDate: string | null): string | null {
  if (!isoDate) return null
  const m = isoDate.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const month = MONTHS_FR[Number.parseInt(m[2], 10) - 1]
  return month ? `${month} ${m[1]}` : null
}

// Chiffres uniquement (meme regle que lib/collections readAmount) :
// parseInt seul accepterait « 100abc » -> 100.
export function parseStrictAmount(input: string): number {
  const raw = input.replace(/\s/g, "")
  return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : Number.NaN
}
