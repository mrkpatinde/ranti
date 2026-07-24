// Libellés partagés des documents (source unique) : consommés par le PDF
// (lib/receipts/pdf.tsx), la page locataire (/recu/[token]) et les surfaces
// de vérification (/verifier, /verifier/[id]). Ajouter un moyen de paiement
// ou un type de document se fait ICI, une seule fois.

export const methodLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
}

export const kindLabels: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
}
