import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordDueBalances } from "@/lib/rent-dues/queries"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import { buildDashboardSummary } from "@/lib/dashboard/summary"
import { AccountMenu } from "./_components/account-menu"

export const metadata = { title: "Ranti" }

const fmt = (n: number) => n.toLocaleString("fr-FR")

function initialsOf(first: string, last: string): string {
  return (`${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "R").trim()
}

// Dashboard propriétaire = lecture seule (ADR-020, dashboard-owner v2) : qui a
// payé / qui doit, rien de plus. Pas de saisie ici (le rail FeexPay encaisse,
// ADR-019). Onboarding vierge → une seule action : créer un bail.
export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const leases = await getLandlordLeases(landlord.id)
  const hasActiveLease = leases.some((lease) => lease.status === "active")

  if (!hasActiveLease) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
        <header className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Bonjour {landlord.first_name}
          </h1>
          <p className="text-sm text-muted-foreground">Bienvenue sur Ranti</p>
        </header>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            Créer votre premier bail
          </h2>
          <p className="mt-2 text-base leading-7 text-foreground/70">
            Lieu, logement, occupant et loyer en un geste. Les échéances se génèrent aussitôt.
          </p>
          <Link
            href="/leases/new"
            className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
          >
            Créer un bail
          </Link>
        </div>
      </main>
    )
  }

  const [balances, tenants, units] = await Promise.all([
    getLandlordDueBalances(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
  ])

  const summary = buildDashboardSummary(balances)
  const tenantName = new Map(tenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`]))
  const unitName = new Map(units.map((u) => [u.id, u.name]))
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  return (
    <main className="mx-auto w-full max-w-md space-y-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Bonjour {landlord.first_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{month}</p>
        </div>
        <AccountMenu initials={initialsOf(landlord.first_name, landlord.last_name)} />
      </header>

      <div className="flex overflow-hidden rounded-2xl border border-border bg-card">
        <Stat label="Payé" value={summary.paid} className="text-accent" />
        <Stat label="Attendu" value={summary.expected} className="text-foreground" divider />
        <Stat label="Retard" value={summary.overdue} className="text-destructive" divider />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">À encaisser</h2>

        {summary.owed.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
            Tout est encaissé. Rien à relancer.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {summary.owed.map((line) => (
              <Link
                key={line.dueId}
                href={`/leases/${line.leaseId}`}
                className="flex items-center gap-3 border-t border-border px-5 py-4 transition first:border-t-0 hover:bg-secondary/50"
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${line.late ? "bg-destructive" : "bg-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-foreground">
                    {tenantName.get(line.tenantId) ?? "Locataire"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {unitName.get(line.unitId) ?? "Logement"} · {line.late ? "en retard" : "attendu"}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${line.late ? "text-destructive" : "text-foreground"}`}
                >
                  {fmt(line.remaining)}
                </span>
                <span aria-hidden className="text-lg leading-none text-muted-foreground">
                  ›
                </span>
              </Link>
            ))}
          </div>
        )}

        {summary.upToDateCount > 0 ? (
          <p className="text-center text-sm text-accent">
            {summary.upToDateCount} locataire{summary.upToDateCount > 1 ? "s" : ""} à jour
          </p>
        ) : null}
      </section>

      <Link
        href="/leases/new"
        className="flex w-full items-center justify-center rounded-2xl bg-accent px-5 py-4 text-base font-semibold text-accent-foreground transition hover:brightness-95"
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
    <div className={`flex-1 px-3 py-4 text-center ${divider ? "border-l border-border" : ""}`}>
      <div className={`text-base font-semibold tabular-nums ${className}`}>{value.toLocaleString("fr-FR")}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
