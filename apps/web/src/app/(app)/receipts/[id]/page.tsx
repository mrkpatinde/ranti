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

const kindLabels = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
} as const

const noticeLabels: Record<string, string> = {
  receipt_generated: "Document généré.",
  receipt_cancelled: "Document annulé.",
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
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{kindLabels[receipt.kind]}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/receipts/${receipt.id}/pdf`}
            className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Télécharger le PDF
          </a>
          <Link href="/receipts" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
            Tous les documents
          </Link>
        </div>
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

        <article className="rounded-3xl border border-neutral-200 bg-white p-7 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-col justify-center gap-[3px] rounded-lg bg-neutral-950 px-2 dark:bg-neutral-50">
                <span className="h-[3px] w-5 rounded-full bg-white dark:bg-neutral-950" />
                <span className="h-[3px] w-[15px] rounded-full bg-white dark:bg-neutral-950" />
                <span className="h-[3px] w-[10px] rounded-full bg-white dark:bg-neutral-950" />
              </span>
              <div>
                <p className="font-medium text-neutral-950 dark:text-neutral-50">Ranti</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Registre de loyer</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-medium text-neutral-950 dark:text-neutral-50">{kindLabels[receipt.kind]}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">N° {receipt.receipt_number}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Émise le {formatDate(receipt.issued_at)}</p>
              {receipt.status === "cancelled" ? (
                <span className="mt-1 inline-flex rounded-lg border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:text-red-200">
                  {statusLabels[receipt.status]}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-neutral-200 py-5 dark:border-neutral-800">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-neutral-400">De</p>
              <p className="mt-1.5 text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {landlord.first_name} {landlord.last_name}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">Propriétaire</p>
              {landlord.phone ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{landlord.phone}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-neutral-400">À</p>
              <p className="mt-1.5 text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}` : "Locataire"}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">Locataire</p>
              {snap.unit ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{snap.unit.name}</p>
              ) : null}
            </div>
          </div>

          {snap.allocations && snap.allocations.length > 0 ? (
            <div className="border-b border-neutral-200 py-5 dark:border-neutral-800">
              <div className="flex justify-between text-xs text-neutral-400">
                <span>Période réglée</span>
                <span>Montant</span>
              </div>
              {snap.allocations.map((a, i) => (
                <div key={i} className="flex justify-between gap-4 py-1.5 text-sm">
                  <span className="text-neutral-700 dark:text-neutral-200">{formatPeriod(a.period_start, a.period_end)}</span>
                  <span className="text-neutral-950 dark:text-neutral-50">{formatAmount(a.amount_allocated)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 py-5 dark:border-neutral-800">
            <div>
              <p className="text-sm text-neutral-400">Total payé</p>
              {snap.reception ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  {methodLabels[snap.reception.payment_method] ?? snap.reception.payment_method} · reçu le{" "}
                  {formatDate(snap.reception.received_at)}
                </p>
              ) : null}
            </div>
            <p className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">{formatAmount(receipt.total_amount)}</p>
          </div>

          <p className="py-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {receipt.kind === "quittance"
              ? "Le présent document vaut quittance : le loyer de la période ci-dessus est intégralement payé."
              : "Reçu de paiement pour la somme ci-dessus. Le loyer n'est pas intégralement soldé : ce document ne vaut pas quittance."}
          </p>

          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-neutral-300 text-xs text-neutral-400 dark:border-neutral-700">
                QR
              </span>
              <span className="max-w-[140px] text-xs text-neutral-400">Vérifier l&apos;authenticité en ligne (bientôt)</span>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-neutral-300 pt-1.5 text-xs text-neutral-400 dark:border-neutral-700">
                Signature du propriétaire
              </div>
            </div>
          </div>
        </article>

        {receipt.status === "cancelled" && receipt.cancellation_reason ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Motif d&apos;annulation : {receipt.cancellation_reason}</p>
        ) : null}

        {receipt.status === "issued" ? (
          <form action={cancelReceipt} className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <input type="hidden" name="id" value={receipt.id} />
            <label htmlFor="reason" className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">
              Motif d&apos;annulation
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={2}
              placeholder="Ex. erreur de montant, paiement non reçu"
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
            />
            <button
              type="submit"
              className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
            >
              Annuler ce document
            </button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
