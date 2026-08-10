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

// Vocabulaire (retour fondateur 2026-08-10, ADR-027) : au Bénin, le document
// du loyer intégralement payé est une QUITTANCE ; « reçu » n'est correct que
// pour un paiement partiel. Jamais « reçu de loyer ».
export const kindLabels: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement partiel",
}
