// Verdict d'intégrité d'un reçu pour la page publique /verifier.
//
// Le recalcul de l'empreinte SHA-256 vit en SQL (RPC verify_receipt_integrity),
// seul endroit où snapshot::text est sérialisé exactement comme à la
// certification. Ici on ne fait que COMPARER deux empreintes hex déjà
// calculées et en déduire l'état affiché. Fonction pure -> testable, aucune
// dépendance réseau.

export type ReceiptIntegrityState =
  | "cancelled" // annulé par l'émetteur : ne vaut plus preuve
  | "verified" // scellé + empreinte recalculée identique à l'empreinte stockée
  | "tampered" // scellé mais empreintes divergentes : contenu altéré
  | "unsealed" // émis, pas encore certifié : aucune empreinte d'intégrité

export type ReceiptIntegrityInput = {
  status: string
  storedFingerprint: string | null
  computedFingerprint: string | null
}

// Ordre des priorités :
// 1. Annulé prime : le document ne vaut plus preuve, quel que soit le hash.
// 2. Pas d'empreinte stockée -> non scellé (reçu émis mais pas certifié).
// 3. Empreinte stockée -> comparaison stricte au recalcul. Toute absence ou
//    divergence du recalcul bascule en « altéré » : jamais un faux « vérifié ».
export function receiptIntegrityVerdict(
  input: ReceiptIntegrityInput,
): ReceiptIntegrityState {
  if (input.status === "cancelled") return "cancelled"

  const stored = input.storedFingerprint?.trim()
  if (!stored) return "unsealed"

  const computed = input.computedFingerprint?.trim()
  return computed && computed === stored ? "verified" : "tampered"
}
