// Libellé exact du consentement à la quittance électronique. Source unique :
// c'est CE texte que le locataire lit sous le bouton de confirmation, et ce
// texte verbatim que la RPC grant_ereceipt_consent archive en base (valeur
// probante). Ne pas reformuler sans décision : un changement crée une
// nouvelle version de l'accord.
//
// v2 (2026-08-10, retour fondateur) : l'écran de consentement séparé
// disparaît — le locataire voit directement sa quittance, et l'accord est
// enregistré AU MOMENT de la confirmation (une seule action au lieu de deux
// coches). Les accords v1 déjà archivés restent intacts : la table
// tenant_consents est write-once et immuable par trigger.
export const ERECEIPT_CONSENT_WORDING =
  "En confirmant, vous acceptez de recevoir vos quittances par voie électronique."

// Statut renvoyé par la RPC ereceipt_consent_status (token-scopée, anon).
export type EreceiptConsentStatus = {
  found: boolean
  granted_at: string | null
  tenant_first_name: string | null
}
