// Libellé exact du consentement à la quittance électronique. Source unique :
// c'est CE texte que le locataire coche, et c'est ce texte verbatim que la RPC
// grant_ereceipt_consent archive en base (valeur probante). Ne pas reformuler
// sans décision : un changement crée une nouvelle version de l'accord.
export const ERECEIPT_CONSENT_WORDING =
  "J'accepte de recevoir mes quittances de loyer au format électronique via Ranti."

// Statut renvoyé par la RPC ereceipt_consent_status (token-scopée, anon).
export type EreceiptConsentStatus = {
  found: boolean
  granted_at: string | null
  tenant_first_name: string | null
}
