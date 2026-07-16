// Formatage des montants FCFA — SEULE source de vérité (ledger : le même
// montant doit s'écrire pareil sur tous les écrans, le PDF et WhatsApp).
// Séparateur de milliers : espace fine insécable (U+202F), la typographie
// française correcte — le montant ne se coupe jamais en fin de ligne.
const NNBSP = " "

function groupThousands(amount: number, separator: string): string {
  const safeAmount = Number.isFinite(amount) ? Math.trunc(amount) : 0
  const formatted = Math.abs(safeAmount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator)

  return `${safeAmount < 0 ? "-" : ""}${formatted}`
}

export function formatFcfa(amount: number): string {
  return `${groupThousands(amount, NNBSP)}${NNBSP}FCFA`
}

// Sans unité — pour les tuiles de stats qui portent « FCFA » à part.
// NB : si un canal SMS renaît un jour (ADR-022), lui redonner une variante à
// espace ASCII — une espace U+202F bascule tout le SMS en UCS-2 (segments x2).
export function formatFcfaNumber(amount: number): string {
  return groupThousands(amount, NNBSP)
}
