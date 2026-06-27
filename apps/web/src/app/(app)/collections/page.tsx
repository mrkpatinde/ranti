import Link from "next/link"
import {
  cancelCollection,
  confirmCollection,
  getLandlordCollections,
  type Collection,
  type CollectionStatus,
  type PaymentMethod,
} from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
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

const statusLabels: Record<CollectionStatus, string> = {
  draft: "Brouillon — à confirmer",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

const noticeLabels: Record<string, string> = {
  collection_confirmed: "Encaissement confirmé.",
  collection_cancelled: "Encaissement annulé.",
  collection_recorded_unconfirmed:
    "Encaissement enregistré mais non confirmé. Confirmez-le ci-dessous.",
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

// Drafts first (they need the owner's attention), then confirmed, then cancelled.
const statusOrder: Record<CollectionStatus, number> = {
  draft: 0,
  confirmed: 1,
  cancelled: 2,
}

function statusClasses(status: CollectionStatus): string {
  switch (status) {
    case "draft":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    case "confirmed":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
    case "cancelled":
      return "border-neutral-300 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
  }
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  // getLandlordCollections throws (CollectionsQueryError) on a technical/RLS
  // failure instead of returning [] — so a real fault surfaces as an error page
  // rather than being silently shown as "aucun encaissement".
  const [collections, tenants, units] = await Promise.all([
    getLandlordCollections(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
  ])

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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Vos encaissements</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
            Les loyers que vous avez reçus
          </h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Chaque encaissement enregistré reste ici, même non confirmé. Vous ne perdez jamais la
            trace d&apos;un loyer reçu.
          </p>
        </div>

        {notice ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {notice}
          </p>
        ) : null}

        {params?.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            {params.error}
          </p>
        ) : null}

        {draftCount > 0 ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {draftCount === 1
              ? "1 encaissement en brouillon attend votre confirmation."
              : `${draftCount} encaissements en brouillon attendent votre confirmation.`}
          </p>
        ) : null}

        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Aucun encaissement pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Les loyers que vous enregistrerez apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((c) => (
              <article
                key={c.id}
                className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                      {formatAmount(c.amount_received)}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {tenantName(c.tenant_id)} — {unitName(c.unit_id)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {formatDate(c.received_at)} · {methodLabels[c.payment_method]}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${statusClasses(c.status)}`}
                  >
                    {statusLabels[c.status]}
                  </span>
                </div>

                {c.note ? (
                  <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{c.note}</p>
                ) : null}

                {c.status === "cancelled" && c.cancellation_reason ? (
                  <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    Motif : {c.cancellation_reason}
                  </p>
                ) : null}

                {c.status === "draft" ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <form action={confirmCollection}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
                      >
                        Confirmer
                      </button>
                    </form>
                    <form action={cancelCollection}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
                      >
                        Annuler
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
