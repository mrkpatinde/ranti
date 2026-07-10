// Saisie vocale des encaissements (ADR-012). Le vocal résout une phrase
// libre vers un bail actif du propriétaire ; il n'écrit jamais en base.

export type VoiceConfidence = "high" | "medium" | "low"

// Un bail actif tel que fourni à Gemini comme contexte (effet Granola).
export type VoicePortfolioLease = {
  lease_id: string
  tenant_name: string
  unit_name: string
  monthly_rent: number
}

// Sortie structurée attendue de Gemini (Structured Outputs).
export type VoiceExtraction = {
  lease_id: string // doit être l'un des lease_id fournis, sinon vide
  amount: number // 0 si non compris
  period: string // libellé libre ("juillet", "2026-07") ou vide
  tenant_hint: string // nom entendu, pour affichage si non résolu
  confidence: VoiceConfidence
  transcript: string
}

// Réponse de POST /api/voice/collection au client.
export type VoiceCollectionResponse = {
  transcript: string
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
  // Renseigné quand rien n'est résolu, pour guider l'utilisateur.
  tenant_hint: string
}
