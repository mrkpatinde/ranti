import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { RantiLogo } from "@/components/ranti-logo"
import { createAdminClient } from "@/lib/supabase/admin"

// Vérification publique d'un document (cible du QR imprimé sur le PDF).
// Aucune authentification : n'expose que l'authenticité — jamais les montants.

export const metadata: Metadata = {
  title: "Vérification de document — Ranti",
  robots: { index: false, follow: false },
}

type VerifyPageProps = {
  params: Promise<{ id: string }>
}

const kindLabels: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ReceiptSnapshot = {
  tenant?: { first_name?: string; last_name?: string }
  unit?: { name?: string }
  allocations?: Array<{ period_start: string; period_end: string }>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function VerifyReceiptPage({ params }: VerifyPageProps) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const admin = createAdminClient()
  if (!admin) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <RantiLogo size={40} />
        <h1 className="font-display mt-6 text-2xl font-extrabold tracking-tight">Vérification indisponible</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/70">Le service de vérification est momentanément indisponible. Réessayez plus tard.</p>
      </main>
    )
  }

  const { data: receipt } = await admin
    .from("receipts")
    .select("id, receipt_number, kind, status, issued_at, snapshot")
    .eq("id", id)
    .maybeSingle()

  if (!receipt) notFound()

  const snap = (receipt.snapshot ?? {}) as ReceiptSnapshot
  const tenantName = snap.tenant
    ? `${snap.tenant.first_name ?? ""} ${(snap.tenant.last_name ?? "").charAt(0)}${snap.tenant.last_name ? "." : ""}`.trim()
    : null
  const cancelled = receipt.status === "cancelled"

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
          <span
            className={
              cancelled
                ? "shrink-0 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200"
                : "shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground ring-1 ring-primary/20"
            }
          >
            {cancelled ? "Document annulé" : "Document authentique"}
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
          {snap.unit?.name ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Bien</dt>
              <dd className="mt-1 text-sm font-semibold">{snap.unit.name}</dd>
            </div>
          ) : null}
          {snap.allocations && snap.allocations.length > 0 ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Période réglée</dt>
              <dd className="mt-1 text-sm font-semibold">
                {snap.allocations.map((a) => `${formatDate(a.period_start)} → ${formatDate(a.period_end)}`).join(" · ")}
              </dd>
            </div>
          ) : null}
        </dl>

        {cancelled ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Ce document a été annulé par son émetteur. Il ne vaut plus preuve de paiement.
          </p>
        ) : (
          <p className="rounded-xl border border-primary/15 bg-secondary px-4 py-3 text-sm text-foreground/80">
            Ce document a bien été émis par Ranti et n&apos;a pas été modifié depuis. Il correspond au PDF portant le même numéro.
          </p>
        )}

        <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Par confidentialité, les montants ne sont jamais affichés sur cette page publique. Seul le document remis par le propriétaire les mentionne.
        </p>
      </div>
    </main>
  )
}
