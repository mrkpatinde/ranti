import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatFcfa, formatFcfaNumber } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import {
  buildStatementWaLink,
  currentMonth,
  feeRateLabel,
  getClosingRows,
  monthLabel,
  resolveMonth,
  shiftMonth,
  sortClosingRows,
  sumClosingRows,
  type ClosingRow,
} from "@/lib/statements"

// Clôture du mois. L'agence encaisse pour des propriétaires mandants qui ne
// sont pas utilisateurs de Ranti : cet écran dit, mandant par mandant, ce qui
// a été encaissé, ce qui a été retenu en honoraires et ce qui reste à reverser.

type CloturePageProps = {
  searchParams?: Promise<{ mois?: string }>
}

export default async function CloturePage({ searchParams }: CloturePageProps) {
  const sp = await searchParams
  const month = resolveMonth(sp?.mois)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground lg:text-3xl">
          Clôture
        </h1>
        <p className="text-sm leading-6 text-foreground/70">
          Pour chaque mandant : ce qui a été encaissé sur le mois, les honoraires
          retenus, et le net à lui reverser.
        </p>
        <MonthNav month={month} />
      </header>

      {/* key = mois : changer de mois remonte le squelette au lieu de garder
          l'ancien tableau à l'écran pendant la lecture. */}
      <Suspense key={month} fallback={<ClosingSkeleton />}>
        <ClosingData month={month} />
      </Suspense>
    </main>
  )
}

function MonthNav({ month }: { month: string }) {
  const previous = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  const atCurrentMonth = month >= currentMonth()

  return (
    <nav className="flex items-center gap-2" aria-label="Mois de clôture">
      <Link
        href={`/cloture?mois=${previous}`}
        aria-label={`Mois précédent : ${monthLabel(previous)}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-primary"
      >
        <ChevronLeft size={18} />
      </Link>
      <span className="min-w-[9rem] text-center text-base font-medium text-foreground">
        {monthLabel(month)}
      </span>
      {atCurrentMonth ? (
        <span
          aria-hidden
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-muted-foreground/40"
        >
          <ChevronRight size={18} />
        </span>
      ) : (
        <Link
          href={`/cloture?mois=${next}`}
          aria-label={`Mois suivant : ${monthLabel(next)}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-primary"
        >
          <ChevronRight size={18} />
        </Link>
      )}
    </nav>
  )
}

async function ClosingData({ month }: { month: string }) {
  const landlord = await requireLandlordProfile()
  const rows = sortClosingRows(await getClosingRows(landlord.id, month))
  const totals = sumClosingRows(rows)

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-6 text-center">
        <p className="text-sm font-medium text-foreground">Aucun mandant à clôturer.</p>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          Vos mandants arrivent avec l&apos;import de votre portefeuille, ou
          s&apos;ajoutent un par un. Ils apparaissent ici dès qu&apos;un bien
          leur est rattaché.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/import"
            className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
          >
            Importer votre portefeuille
          </Link>
          <Link
            href="/owners/new"
            className="inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary"
          >
            Ajouter un propriétaire
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="mt-6 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Net à reverser</span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-foreground">
            {formatFcfa(totals.net)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatFcfaNumber(totals.collected)} encaissés · {formatFcfaNumber(totals.fee)}{" "}
          d&apos;honoraires
        </p>
      </section>

      {/* Mobile : une carte par mandant. Le tableau à six colonnes ne tient pas
          sur un écran de terrain sans défilement horizontal. */}
      <div className="mt-4 space-y-3 sm:hidden">
        {rows.map((row) => (
          <OwnerCard key={row.ownerId} row={row} month={month} />
        ))}
        <div className="rounded-2xl border border-primary/25 bg-secondary px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              Total · {rows.length} {rows.length > 1 ? "mandants" : "mandant"}
            </span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatFcfaNumber(totals.net)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {totals.units} lots · attendu {formatFcfaNumber(totals.expected)} · encaissé{" "}
            {formatFcfaNumber(totals.collected)} · honoraires {formatFcfaNumber(totals.fee)}
          </p>
        </div>
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                Mandant
              </th>
              <th scope="col" className="px-2 py-3 text-right font-medium">
                Lots
              </th>
              <th scope="col" className="px-2 py-3 text-right font-medium">
                Attendu
              </th>
              <th scope="col" className="px-2 py-3 text-right font-medium">
                Encaissé
              </th>
              <th scope="col" className="px-2 py-3 text-right font-medium">
                Honoraires
              </th>
              <th scope="col" className="px-2 py-3 text-right font-medium">
                Net
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ownerId} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <Link
                    href={`/cloture/${row.ownerId}?mois=${month}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {feeRateLabel(row.feeRateBp)}
                  </span>
                </th>
                <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">
                  {row.units}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">
                  {formatFcfaNumber(row.expected)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">
                  {formatFcfaNumber(row.collected)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{formatFcfaNumber(row.fee)}</td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">
                  {formatFcfaNumber(row.net)}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActions row={row} month={month} compact />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground/20 bg-secondary/60 font-semibold">
              <th scope="row" className="px-4 py-3 text-left">
                Total
              </th>
              <td className="px-2 py-3 text-right tabular-nums">{totals.units}</td>
              <td className="px-2 py-3 text-right tabular-nums">
                {formatFcfaNumber(totals.expected)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                {formatFcfaNumber(totals.collected)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">{formatFcfaNumber(totals.fee)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{formatFcfaNumber(totals.net)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Le message WhatsApp s&apos;ouvre dans votre application, pré-rempli. Vous le relisez
        et l&apos;envoyez vous-même, avec le relevé en pièce jointe.
      </p>
    </>
  )
}

function OwnerCard({ row, month }: { row: ClosingRow; month: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/cloture/${row.ownerId}?mois=${month}`}
            className="block truncate text-base font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {row.units} {row.units > 1 ? "lots" : "lot"} · {feeRateLabel(row.feeRateBp)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatFcfaNumber(row.net)}
          </p>
          <p className="text-xs text-muted-foreground">à reverser</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Attendu</dt>
          <dd className="tabular-nums text-foreground">{formatFcfaNumber(row.expected)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Encaissé</dt>
          <dd className="tabular-nums text-foreground">{formatFcfaNumber(row.collected)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Honoraires</dt>
          <dd className="tabular-nums text-foreground">{formatFcfaNumber(row.fee)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <RowActions row={row} month={month} />
      </div>
    </article>
  )
}

function RowActions({
  row,
  month,
  compact = false,
}: {
  row: ClosingRow
  month: string
  compact?: boolean
}) {
  const wa = buildStatementWaLink({
    phone: row.phone,
    ownerName: row.name,
    month,
    collected: row.collected,
    fee: row.fee,
    net: row.net,
  })
  const pill =
    "inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"

  return (
    <>
      {compact ? null : (
        <Link href={`/cloture/${row.ownerId}?mois=${month}`} className={pill}>
          Relevé
        </Link>
      )}
      <a href={`/cloture/${row.ownerId}/pdf?mois=${month}`} className={pill}>
        PDF
      </a>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={pill}>
          WhatsApp
        </a>
      ) : null}
    </>
  )
}

function ClosingSkeleton() {
  return (
    <div aria-busy className="mt-6 space-y-4">
      <div className="h-[86px] animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <p className="sr-only">Chargement…</p>
    </div>
  )
}
