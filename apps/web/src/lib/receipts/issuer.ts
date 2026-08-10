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
