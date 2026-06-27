import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordReceipts } from "@/lib/receipts"
import type { ReceiptStatus } from "@/lib/receipts"

type ReceiptsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const statusLabels: Record<ReceiptStatus, string> = {
  issued: "Émise",
  cancelled: "Annulée",
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Vos quittances</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
            Vos quittances
          </h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Une quittance est générée depuis un encaissement confirmé.
          </p>
        </div>

        {receipts.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Aucune quittance pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Confirmez un encaissement puis générez sa quittance depuis la page Encaissements.
            </p>
            <Link
              href="/collections"
              className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
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
                className="block rounded-3xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                      {formatAmount(receipt.total_amount)}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {kindLabels[receipt.kind]} · {receipt.receipt_number} · {formatDate(receipt.issued_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                    {statusLabels[receipt.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
