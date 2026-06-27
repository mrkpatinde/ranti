import Link from "next/link"
import { notFound } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { cancelReceipt, getReceipt } from "@/lib/receipts"
import type { ReceiptStatus } from "@/lib/receipts"

type ReceiptDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const statusLabels: Record<ReceiptStatus, string> = {
  issued: "Émise",
  cancelled: "Annulée",
}

const methodLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
}

const noticeLabels: Record<string, string> = {
  receipt_generated: "Quittance générée.",
  receipt_cancelled: "Quittance annulée.",
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} → ${formatDate(end)}`
}

export default async function ReceiptDetailPage({ params, searchParams }: ReceiptDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  const receipt = await getReceipt(landlord.id, id)
  if (!receipt) notFound()

  const snap = receipt.snapshot ?? {}
  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Quittance</p>
        </div>
        <Link href="/receipts" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Toutes les quittances
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        {notice ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {notice}
          </p>
        ) : null}
        {sp?.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            {sp.error}
          </p>
        ) : null}

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                Quittance {receipt.receipt_number}
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Émise le {formatDate(receipt.issued_at)}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
              {statusLabels[receipt.status]}
            </span>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            {snap.tenant ? (
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500 dark:text-neutral-400">Locataire</dt>
                <dd className="text-neutral-950 dark:text-neutral-50">
                  {snap.tenant.first_name} {snap.tenant.last_name}
                </dd>
              </div>
            ) : null}
            {snap.unit ? (
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500 dark:text-neutral-400">Logement</dt>
                <dd className="text-neutral-950 dark:text-neutral-50">{snap.unit.name}</dd>
              </div>
            ) : null}
            {snap.reception ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500 dark:text-neutral-400">Reçu le</dt>
                  <dd className="text-neutral-950 dark:text-neutral-50">{formatDate(snap.reception.received_at)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500 dark:text-neutral-400">Méthode</dt>
                  <dd className="text-neutral-950 dark:text-neutral-50">
                    {methodLabels[snap.reception.payment_method] ?? snap.reception.payment_method}
                  </dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <dt className="font-medium text-neutral-950 dark:text-neutral-50">Total</dt>
              <dd className="font-semibold text-neutral-950 dark:text-neutral-50">{formatAmount(receipt.total_amount)}</dd>
            </div>
          </dl>

          {snap.allocations && snap.allocations.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Périodes réglées</p>
              {snap.allocations.map((a, i) => (
                <div key={i} className="flex justify-between gap-4 text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">{formatPeriod(a.period_start, a.period_end)}</span>
                  <span className="text-neutral-950 dark:text-neutral-50">{formatAmount(a.amount_allocated)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {receipt.status === "cancelled" && receipt.cancellation_reason ? (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Motif : {receipt.cancellation_reason}</p>
          ) : null}

          {receipt.status === "issued" ? (
            <form action={cancelReceipt} className="mt-6">
              <input type="hidden" name="id" value={receipt.id} />
              <button
                type="submit"
                className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
              >
                Annuler la quittance
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  )
}
