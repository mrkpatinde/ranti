import { Suspense } from "react"
import { formatFcfa } from "@/lib/format"
import Link from "next/link"
import { Alert } from "@/components/ui/alert"
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

export default function CollectionsPage({ searchParams }: CollectionsPageProps) {
  // Streaming (fluidité de nav) : le cadre (titre + « Encaisser un loyer »)
  // peint tout de suite, les cartes arrivent en flux sous <Suspense> au lieu
  // de bloquer la navigation sur la vague de requêtes.
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

        <Suspense fallback={<CollectionsSkeleton />}>
          <CollectionsData searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  )
}

async function CollectionsData({ searchParams }: CollectionsPageProps) {
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

  // Maps plutôt que find-dans-la-boucle : la liste des encaissements grandit
  // sans borne avec l'historique (même patron que le dashboard).
  const tenantNames = new Map(tenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`]))
  const unitNames = new Map(units.map((u) => [u.id, u.name]))
  const tenantName = (id: string): string => tenantNames.get(id) ?? "Locataire"
  const unitName = (id: string): string => unitNames.get(id) ?? "Logement"

  const sorted = [...collections].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return b.received_at.localeCompare(a.received_at)
  })

  const draftCount = collections.filter((c: Collection) => c.status === "draft").length
  // Object.hasOwn : un ?notice=__proto__ forgé renverrait Object.prototype
  // (truthy), invalide comme enfant JSX, et ferait tomber la page entière.
  const notice =
    params?.notice && Object.hasOwn(noticeLabels, params.notice) ? noticeLabels[params.notice] : null

  return (
    <>
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
    </>
  )
}

// Silhouette des cartes encaissement (mêmes tokens que loading.tsx : rien qui
// clignote fort), affichée pendant le flux Suspense sous le cadre déjà peint.
function CollectionsSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <div className="h-36 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <div className="h-36 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <div className="h-36 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <p className="sr-only">Chargement…</p>
    </div>
  )
}
