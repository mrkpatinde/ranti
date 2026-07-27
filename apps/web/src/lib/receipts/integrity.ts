// Verdict d'intégrité d'un reçu pour la page publique /verifier.
//
// Le recalcul de l'empreinte SHA-256 vit en SQL (recette unique :
// private.receipt_computed_fingerprint), seul endroit où snapshot::text est
// sérialisé exactement comme au scellement. Ici on ne fait que COMPARER deux
// empreintes hex déjà calculées et en déduire l'état affiché. Fonction pure ->
// testable, aucune dépendance réseau.
//
// Depuis 2026-07-27 le sceau est posé À L'ÉMISSION (migration
// 20260727120000) : tout document émis à partir de là est scellé d'office, et
// `unsealed` ne désigne plus que les documents ANTÉRIEURS jamais certifiés.
// L'état est conservé — il reste le seul honnête pour ces documents-là, et il
// interdit qu'une empreinte absente soit lue comme une empreinte valide.

export type ReceiptIntegrityState =
  | "cancelled" // annulé par l'émetteur : ne vaut plus preuve
  | "verified" // scellé + empreinte recalculée identique à l'empreinte stockée
  | "tampered" // scellé mais empreintes divergentes : contenu altéré
  | "unsealed" // document antérieur au scellement à l'émission, jamais certifié

export type ReceiptIntegrityInput = {
  status: string
  storedFingerprint: string | null
  computedFingerprint: string | null
}

// Ordre des priorités :
// 1. Annulé prime : le document ne vaut plus preuve, quel que soit le hash.
// 2. Pas d'empreinte stockée -> non scellé (document antérieur au scellement
//    à l'émission ; ne se produit plus pour un document émis aujourd'hui).
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
