import type { ReceiptKind } from "./types"

// Message WhatsApp de partage du document au locataire (ADR-013). Vocabulaire
// par kind (retour fondateur 2026-08-10) : « quittance de loyer » pour le
// loyer intégralement payé, « reçu de paiement partiel » sinon — jamais
// « reçu de loyer », ni le doublon « reçu de loyer (quittance) ».
export function buildReceiptShareMessage(kind: ReceiptKind, shareUrl: string): string {
  return kind === "quittance"
    ? `Voici votre quittance de loyer. Ouvrez-la et confirmez son exactitude : ${shareUrl}`
    : `Voici votre reçu de paiement partiel. Ouvrez-le et confirmez son exactitude : ${shareUrl}`
}
