import type { ReceiptIntegrityState } from "@/lib/receipts/integrity"

// Constantes partagées des pages de vérification publique (/verifier,
// /verifier/[id]) : libellés de type et bandeaux d'état d'intégrité.
// Palette tokens uniquement (DESIGN.md) : olive/secondary pour l'intègre,
// destructive pour l'altéré/annulé, muted neutre pour le non scellé.

export const kindLabels: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
}

// Référence imprimée sur les documents : RNT-AAAA-NNNN (année sur 4 chiffres,
// séquence d'au moins 4 chiffres, jamais tronquée au-delà). Le même filtre
// existe côté SQL (verify_receipt_by_number) : garder les deux alignés.
export const REF_PATTERN = /^RNT-\d{4}-\d{4,}$/

export const STATE_BADGE: Record<ReceiptIntegrityState, { label: string; className: string }> = {
  verified: { label: "Intégrité vérifiée", className: "bg-secondary text-foreground ring-1 ring-primary/20" },
  unsealed: { label: "Émis par Ranti", className: "bg-muted text-muted-foreground" },
  tampered: { label: "Intégrité compromise", className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30" },
  cancelled: { label: "Document annulé", className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30" },
}

export function formatVerifyDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}
