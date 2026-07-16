import Link from "next/link"
import { formatFcfa, formatFcfaNumber } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import {
  buildLedgerOverview,
  describeLeaseDebtRow,
  getLandlordLeaseBalances,
  leaseDebtRowAmount,
  overdueByLease,
} from "@/lib/ledger"
import { getLandlordDueBalances } from "@/lib/rent-dues/queries"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import { buildDashboardSummary } from "@/lib/dashboard/summary"
import { computeUpcomingReminders } from "@/lib/reminders/schedule"

export const metadata = { title: "Ranti" }

// Date courte « 20 juil. » à partir d'un YYYY-MM-DD (sans dérive de fuseau).
function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

// Couleur du montant d'une ligne « À encaisser » (tons ADR-023 §6 : retard
// dur = destructive, dû = encre, attente = muted, litige = warning).
const AMOUNT_TONE_CLASS = {
  overdue: "text-destructive",
  due: "text-foreground",
  pending: "text-muted-foreground",
  disputed: "text-warning",
} as const

// Dashboard propriétaire = lecture seule (ADR-020, dashboard-owner v2) : qui a
// payé / qui doit, rien de plus. Pas de saisie ici (le rail FeexPay encaisse,
// ADR-019). Onboarding vierge → une seule action : créer un bail.
//
// Nouvelle lecture (ADR-023) : la vue des impayés et des soldes vient du grand
// livre (vue lease_balances) — une ligne par BAIL, dette consolidée en compte
// courant (une avance sur un mois réduit le dû). « Payé / Attendu » et le taux
// de recouvrement restent des lentilles MENSUELLES, calculées sur
// rent_due_balances — déjà lue pour la cadence des relances (ADR-022).
export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const leases = await getLandlordLeases(landlord.id)
  const hasActiveLease = leases.some((lease) => lease.status === "active")

  if (!hasActiveLease) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12 lg:max-w-xl lg:gap-10">
        <header className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-5xl">
            Bonjour {landlord.first_name}
          </h1>
          <p className="text-sm text-muted-foreground lg:text-base">Bienvenue sur Ranti</p>
        </header>
        <div className="rounded-2xl border border-border bg-card p-6 lg:p-8">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            Créer votre premier bail
          </h2>
          <p className="mt-2 text-base leading-7 text-foreground/70">
            Lieu, logement, occupant et loyer en un geste. Les échéances se génèrent aussitôt.
          </p>
          <Link
            href="/leases/new"
            className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 lg:mt-6"
          >
            Créer un bail
          </Link>
        </div>
      </main>
    )
  }

  const [balances, leaseBalances, tenants, units] = await Promise.all([
    getLandlordDueBalances(landlord.id),
    getLandlordLeaseBalances(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
  ])

  const summary = buildDashboardSummary(balances)
  const overview = buildLedgerOverview(leaseBalances, leases)
  const upcoming = computeUpcomingReminders(balances, overdueByLease(leaseBalances))
  const tenantName = new Map(tenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`]))
  const unitName = new Map(units.map((u) => [u.id, u.name]))
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  return (
    <main className="mx-auto w-full max-w-md space-y-8 px-6 py-10 lg:max-w-2xl lg:space-y-12 lg:py-16">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-5xl">
          Bonjour {landlord.first_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground lg:mt-2 lg:text-base">{month}</p>
      </header>

      <div className="flex overflow-hidden rounded-2xl border border-border bg-card">
        <Stat label="Payé" value={summary.paid} className="text-accent" />
        <Stat label="Attendu" value={summary.expected} className="text-foreground" divider />
        <Stat label="Retard" value={overview.totalOverdue} className="text-destructive" divider />
      </div>

      {summary.collectionRate !== null ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground lg:text-sm">
            <span>Recouvrement de {month}</span>
            <span className="font-semibold tabular-nums text-foreground">{summary.collectionRate} %</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-accent" style={{ width: `${summary.collectionRate}%` }} />
          </div>
        </div>
      ) : null}

      <section className="space-y-3 lg:space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground lg:text-base">À encaisser</h2>

        {overview.rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground lg:py-10 lg:text-base">
            Tout est encaissé. Rien à relancer.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {overview.rows.map((row) => {
              const { amount, tone } = leaseDebtRowAmount(row)
              return (
                <Link
                  key={row.leaseId}
                  href={`/leases/${row.leaseId}`}
                  className="flex items-center gap-3 border-t border-border px-5 py-4 transition first:border-t-0 hover:bg-secondary/50 lg:gap-4 lg:px-6 lg:py-5"
                >
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      row.overdue > 0 ? "bg-destructive" : row.disputed > 0 ? "bg-warning" : "bg-accent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-foreground lg:text-lg">
                      {tenantName.get(row.tenantId) ?? "Locataire"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {unitName.get(row.unitId) ?? "Logement"} · {describeLeaseDebtRow(row)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums lg:text-base ${AMOUNT_TONE_CLASS[tone]}`}
                  >
                    {formatFcfaNumber(amount)}{" "}
                    <span className="text-xs font-medium text-muted-foreground">FCFA</span>
                  </span>
                  <span aria-hidden className="text-lg leading-none text-muted-foreground">
                    ›
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {overview.totalDisputed > 0 ? (
          <p className="text-sm text-warning">
            {formatFcfa(overview.totalDisputed)} en litige — le détail est sur la fiche du bail.
          </p>
        ) : null}

        {overview.upToDateCount > 0 ? (
          <p className="text-center text-sm text-accent lg:text-left">
            {overview.upToDateCount} locataire{overview.upToDateCount > 1 ? "s" : ""} à jour
          </p>
        ) : null}
      </section>

      {upcoming.length > 0 ? (
        <section className="space-y-3 lg:space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground lg:text-base">Relances à venir</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {upcoming.map((r) => (
              <div
                key={r.dueId}
                className="flex items-center gap-3 border-t border-border px-5 py-4 first:border-t-0 lg:gap-4 lg:px-6 lg:py-5"
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${r.late ? "bg-destructive" : "bg-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-foreground lg:text-lg">
                    {tenantName.get(r.tenantId) ?? "Locataire"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {unitName.get(r.unitId) ?? "Logement"} · {r.label}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground lg:text-base">
                  {formatShortDate(r.date)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground lg:text-sm">
            Ranti s&apos;en charge automatiquement — vous n&apos;avez rien à envoyer.
          </p>
        </section>
      ) : null}

      <Link
        href="/leases/new"
        className="flex w-full items-center justify-center rounded-2xl bg-accent px-5 py-4 text-base font-semibold text-accent-foreground transition hover:brightness-95 lg:inline-flex lg:w-auto lg:rounded-full lg:px-7"
      >
        Créer un bail
      </Link>
    </main>
  )
}

function Stat({
  label,
  value,
  className,
  divider,
}: {
  label: string
  value: number
  className: string
  divider?: boolean
}) {
  return (
    <div className={`flex-1 px-3 py-4 text-center ${divider ? "border-l border-border" : ""} lg:py-6`}>
      <div className={`text-base font-semibold tabular-nums lg:text-3xl ${className}`}>
        {formatFcfaNumber(value)}
        <span className="ml-1 text-[11px] font-medium text-muted-foreground lg:text-sm">FCFA</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground lg:mt-1.5 lg:text-sm">{label}</div>
    </div>
  )
}
