// Formatage des montants FCFA — SEULE source de vérité (ledger : le même
// montant doit s'écrire pareil sur tous les écrans, le PDF et WhatsApp).
// Séparateur de milliers : espace insécable U+00A0 — le montant ne se coupe
// jamais en fin de ligne. PAS l'espace fine U+202F : absente de l'encodage
// WinAnsi des polices PDF de base (Helvetica), elle s'imprimait « / » sur la
// quittance (bug terrain : « 120/000/FCFA »).
const NBSP = " "

function groupThousands(amount: number, separator: string): string {
  const safeAmount = Number.isFinite(amount) ? Math.trunc(amount) : 0
  const formatted = Math.abs(safeAmount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator)

  return `${safeAmount < 0 ? "-" : ""}${formatted}`
}

export function formatFcfa(amount: number): string {
  return `${groupThousands(amount, NBSP)}${NBSP}FCFA`
}

// Sans unité — pour les tuiles de stats qui portent « FCFA » à part.
// NB : si un canal SMS renaît un jour (ADR-022), lui redonner une variante à
// espace ASCII — une espace U+00A0 bascule tout le SMS en UCS-2 (segments x2).
export function formatFcfaNumber(amount: number): string {
  return groupThousands(amount, NBSP)
}

// Mois français accentués, seule source de vérité (quittances, en-têtes de
// période). Index 0 = janvier.
export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const
