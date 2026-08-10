import type { ReceiptSnapshot } from "./types"

// Nom de l'émetteur tel qu'imprimé sur la quittance (écran + PDF).
//
// Depuis le pivot entreprises de gestion (migration 20260810120000), le
// snapshot fige un bloc `landlord` portant la raison sociale : elle prime
// quand elle existe. Les snapshots émis avant n'ont pas la clé — le rendu
// retombe alors sur le nom de la personne, exactement comme avant (jamais de
// « undefined » : le document émis se reproduit à l'identique).
export function receiptIssuerName(
  snapshot: ReceiptSnapshot | null | undefined,
  personName: string,
): string {
  const company = snapshot?.landlord?.company_name?.trim()
  return company || personName
}

// Petite ligne d'identification légale « RCCM … · IFU … », rendue sous le nom
// de l'émetteur (écran + PDF, quittance comme relevé) quand au moins un des
// identifiants existe. Null sinon : les documents antérieurs à la migration
// 20260810130000 se rendent exactement comme avant.
export function registrationLine(
  rccm: string | null | undefined,
  ifu: string | null | undefined,
): string | null {
  const parts = [
    rccm?.trim() ? `RCCM ${rccm.trim()}` : null,
    ifu?.trim() ? `IFU ${ifu.trim()}` : null,
  ].filter((p): p is string => p !== null)
  return parts.length > 0 ? parts.join(" · ") : null
}

// Ligne RCCM/IFU de l'émetteur d'une quittance, depuis le snapshot figé.
export function receiptIssuerRegistration(
  snapshot: ReceiptSnapshot | null | undefined,
): string | null {
  return registrationLine(
    snapshot?.landlord?.company_rccm,
    snapshot?.landlord?.company_ifu,
  )
}
