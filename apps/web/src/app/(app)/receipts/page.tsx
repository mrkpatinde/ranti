import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordReceipts } from "@/lib/receipts"
import type { ReceiptStatus, TenantAck } from "@/lib/receipts"

type ReceiptsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const statusLabels: Record<ReceiptStatus, string> = {
  issued: "Émise",
  cancelled: "Annulée",
}

// ADR-013 — acquittement locataire. On ne montre un badge que quand il y a un
// signal (ouvert / certifié / contesté) ; `unilateral` reste silencieux.
const ackBadge: Record<TenantAck, { label: string; cls: string } | null> = {
  unilateral: null,
  read: { label: "Ouvert", cls: "border-amber-300 text-amber-700" },
  certified: { label: "Certifié", cls: "border-primary/30 text-primary" },
  disputed: { label: "Contesté", cls: "border-red-300 text-red-700" },
}

const kindLabels = {
  quittance: "Quittance",
  receipt: "Reçu",
} as const

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const landlord = await requireLandlordProfile()
  await searchParams
  const receipts = await getLandlordReceipts(landlord.id)
  const disputedCount = receipts.filter((r) => r.tenant_ack === "disputed").length

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Vos quittances</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">
            Vos quittances
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Une quittance est générée depuis un encaissement confirmé.
          </p>
        </div>

        {disputedCount > 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
            {disputedCount === 1
              ? "1 reçu est contesté par un locataire."
              : `${disputedCount} reçus sont contestés par des locataires.`}{" "}
            Ouvrez-les pour voir la version du locataire.
          </div>
        ) : null}

        {receipts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Aucune quittance pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Confirmez un encaissement puis générez sa quittance depuis la page Encaissements.
            </p>
            <Link
              href="/collections"
              className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Voir les encaissements
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={`/receipts/${receipt.id}`}
                className="block rounded-2xl border border-border bg-card p-6 transition hover:border-primary"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                      {formatAmount(receipt.total_amount)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {kindLabels[receipt.kind]} · {receipt.receipt_number} · {formatDate(receipt.issued_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80">
                      {statusLabels[receipt.status]}
                    </span>
                    {ackBadge[receipt.tenant_ack] ? (
                      <span className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${ackBadge[receipt.tenant_ack]!.cls}`}>
                        {ackBadge[receipt.tenant_ack]!.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
