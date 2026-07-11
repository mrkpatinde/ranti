// Collage SMS Mobile Money (ADR-014). Jumeau texte du pipeline vocal ADR-012 :
// le propriétaire colle le SMS brut de l'opérateur, on l'extrait et on le
// résout vers un bail actif. Aucune écriture en base ici (comme le vocal).

import type { VoiceConfidence } from "@/lib/voice"

// Sortie structurée attendue de Gemini (Structured Outputs).
export type SmsExtraction = {
  amount: number // FCFA entier, 0 si non compris
  sender_name: string // nom de l'émetteur lu dans le SMS, "" si absent
  transaction_ref: string // réf d'opération (dédup), "" si absente
  lease_id: string // doit être l'un des lease_id fournis, sinon ""
  period: string // libellé libre ("juillet", "2026-07") ou ""
  tenant_hint: string // nom entendu, pour affichage si non résolu
  confidence: VoiceConfidence
}

// Réponse de POST /api/sms/collection au client (carte de validation).
export type SmsCollectionResponse = {
  amount: number
  sender_name: string
  transaction_ref: string
  // Résolu et validé côté serveur contre le portefeuille du propriétaire.
  match: {
    lease_id: string
    tenant_name: string
    unit_name: string
    monthly_rent: number
    amount: number
    period: string
    confidence: VoiceConfidence
  } | null
  tenant_hint: string
  // true si transaction_ref déjà présente sur un encaissement vivant : le SMS
  // a probablement déjà été collé. Le client affiche un avertissement.
  duplicate: boolean
}
