import { formatFcfa } from "@/lib/format"
import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { Alert } from "@/components/ui/alert"
import { badgeClasses } from "@/components/ui/badge"
import { CollectionCard } from "./collection-card"
import {
  getLandlordCollections,
  type Collection,
  type CollectionStatus,
  type PaymentMethod,
} from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordReceipts } from "@/lib/receipts"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

type CollectionsPageProps = {
  searchParams?: Promise<{
    notice?: string
    error?: string
  }>
}

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
}

const noticeLabels: Record<string, string> = {
  collection_confirmed_document_pending:
    "Encaissement confirmé. Le document n'a pas été généré automatiquement ; vous pouvez le générer depuis l'encaissement.",
  collection_recorded_unconfirmed:
    "Encaissement enregistré mais non confirmé. Confirmez-le ci-dessous.",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

const statusOrder: Record<CollectionStatus, number> = {
  draft: 0,
  confirmed: 1,
  cancelled: 2,
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  const [collections, tenants, units, receipts] = await Promise.all([
    getLandlordCollections(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
    getLandlordReceipts(landlord.id),
  ])

  const receiptByReception = new Map(
    receipts.filter((r) => r.status !== "cancelled").map((r) => [r.rent_reception_id, r]),
  )
  // Encaissements dont le document a été annulé (flux de correction) :
  // l'encaissement reste confirmé, il faut le dire clairement au propriétaire.
  const cancelledReceiptReceptions = new Set(
    receipts.filter((r) => r.status === "cancelled").map((r) => r.rent_reception_id),
  )

  const tenantName = (id: string): string => {
    const t = tenants.find((tenant) => tenant.id === id)
    return t ? `${t.first_name} ${t.last_name}` : "Locataire"
  }
  const unitName = (id: string): string => units.find((u) => u.id === id)?.name ?? "Logement"

  const sorted = [...collections].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return b.received_at.localeCompare(a.received_at)
  })

  const draftCount = collections.filter((c: Collection) => c.status === "draft").length
  const notice = params?.notice ? noticeLabels[params.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Vos encaissements</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Accueil
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">
            Les loyers que vous avez reçus
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Chaque encaissement enregistré reste ici, même non confirmé. Vous ne perdez jamais la
            trace d&apos;un loyer reçu.
          </p>
          <Link
            href="/collections/new"
            className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
          >
            Encaisser un loyer
          </Link>
        </div>

        {notice ? <Alert variant="success">{notice}</Alert> : null}

        {params?.error ? <Alert variant="error">{params.error}</Alert> : null}

        {draftCount > 0 ? (
          <Alert variant="info">
            {draftCount === 1
              ? "1 encaissement en brouillon attend votre confirmation."
              : `${draftCount} encaissements en brouillon attendent votre confirmation.`}
          </Alert>
        ) : null}

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Aucun encaissement pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Les loyers que vous enregistrerez apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((c) => (
              <CollectionCard
                key={c.id}
                id={c.id}
                status={c.status}
                amountLabel={formatFcfa(c.amount_received)}
                partiesLine={`${tenantName(c.tenant_id)} — ${unitName(c.unit_id)}`}
                metaLine={`${formatDate(c.received_at)} · ${methodLabels[c.payment_method]}`}
                paymentReference={c.payment_reference ?? null}
                note={c.note ?? null}
                cancellationReason={c.cancellation_reason ?? null}
                receiptId={receiptByReception.get(c.id)?.id ?? null}
                receiptCancelled={cancelledReceiptReceptions.has(c.id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
