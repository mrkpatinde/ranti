import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { formatFcfa, formatFcfaNumber } from "@/lib/format"
import {
  buildStatementWaLink,
  feeRateLabel,
  getOwnerStatement,
  monthLabel,
  resolveMonth,
  sumStatementLines,
  type OwnerStatementLine,
} from "@/lib/statements"

// Le relevé à l'écran, dans la forme exacte du PDF remis au mandant : en-tête
// agence, mandant, période, une ligne par lot (un lot vacant reste affiché à
// zéro), totaux, et l'impayé du mois s'il y en a un.

type StatementPageProps = {
  params: Promise<{ ownerId: string }>
  searchParams?: Promise<{ mois?: string }>
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function lotLabel(line: OwnerStatementLine): string {
  return [line.property_name, line.unit_name].filter(Boolean).join(" · ") || "Lot"
}

export default async function OwnerStatementPage({ params, searchParams }: StatementPageProps) {
  const { ownerId } = await params
  const sp = await searchParams
  const month = resolveMonth(sp?.mois)

  const statement = await getOwnerStatement(ownerId, month)
  if (!statement) notFound()

  const { owner, agency, period, lines } = statement
  // Totaux recalculés depuis les lignes affichées : ce que le mandant voit
  // s'additionne à la main, sur l'écran comme sur le PDF.
  const totals = sumStatementLines(lines)
  const agencyName = agency.name?.trim() || "Agence"
  const agencyAddress = [agency.address, agency.city].filter(Boolean).join(", ")
  const rate = feeRateLabel(owner.fee_rate_bp)
  const wa = buildStatementWaLink({
    phone: owner.phone,
    ownerName: owner.display_name,
    month,
    collected: totals.collected,
    fee: totals.fee,
    net: totals.net,
  })
  const pill =
    "inline-flex items-center rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary"

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={`/cloture?mois=${month}`}
        className="inline-flex items-center gap-1 text-sm text-foreground/70 underline-offset-4 hover:underline"
      >
        <ChevronLeft size={16} />
        Clôture
      </Link>

      <header className="mt-4 rounded-2xl border border-border bg-card px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-foreground">{agencyName}</p>
            {agencyAddress ? (
              <p className="text-sm text-muted-foreground">{agencyAddress}</p>
            ) : null}
            {agency.phone ? <p className="text-sm text-muted-foreground">{agency.phone}</p> : null}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-base font-semibold text-foreground">Relevé de gestion</p>
            <p className="text-sm text-muted-foreground">{monthLabel(period.month)}</p>
            <p className="text-sm text-muted-foreground">
              Du {formatDate(period.from)} au {formatDate(period.to)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Propriétaire mandant
            </p>
            <p className="mt-1 font-medium text-foreground">{owner.display_name}</p>
            {owner.phone ? <p className="text-sm text-muted-foreground">{owner.phone}</p> : null}
            {owner.email ? <p className="text-sm text-muted-foreground">{owner.email}</p> : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Honoraires de gestion
            </p>
            <p className="mt-1 font-medium text-foreground">{rate} des sommes encaissées</p>
            <p className="text-sm text-muted-foreground">Montants en francs CFA (XOF)</p>
          </div>
        </div>
      </header>

      {/* Mobile : une carte par lot. */}
      <div className="mt-4 space-y-3 sm:hidden">
        {lines.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-foreground/70">
            Aucun lot géré pour ce mandant sur la période.
          </div>
        ) : (
          lines.map((line) => (
            <article key={line.unit_id} className="rounded-2xl border border-border bg-card px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{lotLabel(line)}</p>
                  <p className={`text-sm ${line.tenant_name ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                    {line.tenant_name ?? "Vacant"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold tabular-nums text-foreground">
                    {formatFcfaNumber(line.net)}
                  </p>
                  <p className="text-xs text-muted-foreground">net</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Attendu</dt>
                  <dd className="tabular-nums text-foreground">{formatFcfaNumber(line.expected)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Encaissé</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatFcfaNumber(line.collected)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Honoraires</dt>
                  <dd className="tabular-nums text-foreground">{formatFcfaNumber(line.fee)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                Bien · lot
              </th>
              <th scope="col" className="px-2 py-3 font-medium">
                Locataire
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
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-foreground/70">
                  Aucun lot géré pour ce mandant sur la période.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.unit_id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {lotLabel(line)}
                  </th>
                  <td
                    className={`px-2 py-3 ${line.tenant_name ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {line.tenant_name ?? "Vacant"}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {formatFcfaNumber(line.expected)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {formatFcfaNumber(line.collected)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {formatFcfaNumber(line.fee)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatFcfaNumber(line.net)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground/20 bg-secondary/60 font-semibold">
              <th scope="row" className="px-4 py-3 text-left">
                Total
              </th>
              <td className="px-2 py-3 text-muted-foreground">
                {lines.length} {lines.length > 1 ? "lots" : "lot"}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                {formatFcfaNumber(totals.expected)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                {formatFcfaNumber(totals.collected)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">{formatFcfaNumber(totals.fee)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatFcfaNumber(totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-4 rounded-2xl border border-primary/25 bg-secondary px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            Net à reverser au propriétaire
          </span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-foreground">
            {formatFcfa(totals.net)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatFcfaNumber(totals.collected)} encaissés moins {formatFcfaNumber(totals.fee)}{" "}
          d&apos;honoraires ({rate}), calculés lot par lot.
        </p>
      </section>

      {totals.outstanding > 0 ? (
        <Alert variant="warning" className="mt-4">
          Impayé du mois : {formatFcfa(totals.outstanding)}. Écart entre les loyers attendus
          sur la période et les sommes encaissées.
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <a href={`/cloture/${owner.id}/pdf?mois=${month}`} className={pill}>
          Télécharger le PDF
        </a>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={pill}>
            Envoyer par WhatsApp
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        WhatsApp s&apos;ouvre avec un message pré-rempli. Vous le relisez, joignez le PDF et
        l&apos;envoyez vous-même.
      </p>
    </main>
  )
}
