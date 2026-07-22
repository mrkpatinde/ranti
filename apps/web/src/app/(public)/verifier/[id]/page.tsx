import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { RantiLogo } from "@/components/ranti-logo"
import { createClient } from "@/lib/supabase/server"
import {
  receiptIntegrityVerdict,
  type ReceiptIntegrityState,
} from "@/lib/receipts/integrity"

// Vérification publique d'un document (cible du QR imprimé sur le PDF).
// Aucune authentification : n'expose que l'authenticité, jamais les montants.
// L'anon ne lit aucune table en direct : uniquement la RPC SECURITY DEFINER
// verify_receipt_integrity, qui recalcule l'empreinte SHA-256 côté SQL et la
// renvoie à côté de l'empreinte scellée. La page COMPARE les deux et tranche.

export const metadata: Metadata = {
  title: "Vérification de document — Ranti",
  robots: { index: false, follow: false },
}

type VerifyPageProps = {
  params: Promise<{ id: string }>
}

type IntegrityRow = {
  receipt_number: string
  kind: string
  status: string
  issued_at: string
  tenant_first_name: string | null
  tenant_last_name: string | null
  unit_name: string | null
  allocations: Array<{ period_start: string; period_end: string }>
  tenant_ack: string
  stored_fingerprint: string | null
  computed_fingerprint: string | null
}

const kindLabels: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
}

// Un libellé + un style de bandeau par état d'intégrité. Palette tokens
// uniquement (DESIGN.md) : olive/secondary pour l'intègre, destructive pour
// l'altéré/annulé, muted neutre pour le non scellé.
const STATE_BADGE: Record<ReceiptIntegrityState, { label: string; className: string }> = {
  verified: { label: "Intégrité vérifiée", className: "bg-secondary text-foreground ring-1 ring-primary/20" },
  unsealed: { label: "Émis par Ranti", className: "bg-muted text-muted-foreground" },
  tampered: { label: "Intégrité compromise", className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30" },
  cancelled: { label: "Document annulé", className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30" },
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function VerifyReceiptPage({ params }: VerifyPageProps) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("verify_receipt_integrity", { p_id: id })

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <RantiLogo size={40} />
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight">Vérification indisponible</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/70">Le service de vérification est momentanément indisponible. Réessayez plus tard.</p>
      </main>
    )
  }

  const receipt = (data as IntegrityRow[] | null)?.[0]
  if (!receipt) notFound()

  const state = receiptIntegrityVerdict({
    status: receipt.status,
    storedFingerprint: receipt.stored_fingerprint,
    computedFingerprint: receipt.computed_fingerprint,
  })
  const badge = STATE_BADGE[state]

  const tenantName = receipt.tenant_first_name
    ? `${receipt.tenant_first_name} ${(receipt.tenant_last_name ?? "").charAt(0)}${receipt.tenant_last_name ? "." : ""}`.trim()
    : null

  const showFingerprint =
    receipt.stored_fingerprint && (state === "verified" || state === "tampered")

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-border bg-card p-7 shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)]">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <RantiLogo size={34} />
            <div>
              <p className="font-display font-extrabold tracking-tight">Ranti</p>
              <p className="text-xs text-muted-foreground">Vérification de document</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        <dl className="space-y-4 py-5">
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Type</dt>
            <dd className="mt-1 text-sm font-semibold">{kindLabels[receipt.kind] ?? "Document"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Numéro</dt>
            <dd className="mt-1 text-sm font-semibold [font-variant-numeric:tabular-nums]">{receipt.receipt_number}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Émis le</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(receipt.issued_at)}</dd>
          </div>
          {tenantName ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Locataire</dt>
              <dd className="mt-1 text-sm font-semibold">{tenantName}</dd>
            </div>
          ) : null}
          {receipt.unit_name ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Bien</dt>
              <dd className="mt-1 text-sm font-semibold">{receipt.unit_name}</dd>
            </div>
          ) : null}
          {receipt.allocations && receipt.allocations.length > 0 ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Période réglée</dt>
              <dd className="mt-1 text-sm font-semibold">
                {receipt.allocations.map((a) => `${formatDate(a.period_start)} → ${formatDate(a.period_end)}`).join(" · ")}
              </dd>
            </div>
          ) : null}
        </dl>

        {state === "verified" ? (
          <p className="rounded-xl border border-primary/15 bg-secondary px-4 py-3 text-sm text-foreground/80">
            Empreinte recalculée identique à celle scellée à la certification : ce document n&apos;a pas été modifié depuis. Il correspond au PDF portant le même numéro.
          </p>
        ) : state === "unsealed" ? (
          <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
            Ce document a bien été émis par Ranti. Il n&apos;a pas encore été certifié par le locataire : aucune empreinte d&apos;intégrité n&apos;y est scellée.
          </p>
        ) : state === "tampered" ? (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            L&apos;empreinte recalculée ne correspond pas à celle scellée à la certification. Ce document a été modifié depuis : il ne vaut pas preuve de paiement.
          </p>
        ) : (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Ce document a été annulé par son émetteur. Il ne vaut plus preuve de paiement.
          </p>
        )}

        {showFingerprint ? (
          <p className="mt-4 break-all text-xs leading-5 text-muted-foreground">
            Empreinte SHA-256 scellée :{" "}
            <span className="font-mono text-[0.72rem] text-foreground">{receipt.stored_fingerprint}</span>
          </p>
        ) : null}

        <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Par confidentialité, les montants ne sont jamais affichés sur cette page publique. Seul le document remis par le propriétaire les mentionne.
        </p>
      </div>
    </main>
  )
}
