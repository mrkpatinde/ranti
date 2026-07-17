import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordDueBalances } from "@/lib/rent-dues/queries"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import { buildDashboardSummary } from "@/lib/dashboard/summary"
import { getOnboardingProgress } from "@/lib/onboarding/progress"
import { ResumeOnboarding } from "@/components/resume-onboarding"
import { WelcomeOverlay } from "./_components/welcome-overlay"
import { PremiersPas } from "./_components/premiers-pas"
import { OnboardingComplete } from "./_components/onboarding-complete"

export const metadata = { title: "Ranti" }

const fmt = (n: number) => n.toLocaleString("fr-FR")

// Dashboard propriétaire = lecture seule (ADR-020, dashboard-owner v2) : qui a
// payé / qui doit, rien de plus. Pas de saisie ici (le rail FeexPay encaisse,
// ADR-019). Prise en main guidée non bloquante (welcome-flow.md) posée par-dessus :
// accueil (pending) → checklist (guided) | exploration (« Passer pour l'instant »).
export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const status = landlord.onboarding_status ?? "done"
  const leases = await getLandlordLeases(landlord.id)
  const hasActiveLease = leases.some((lease) => lease.status === "active")

  // Progression dérivée seulement quand le guidage est en cours.
  const progress = status === "guided" ? await getOnboardingProgress(landlord.id) : null
  const showChecklist = progress != null && !progress.allDone
  const justCompleted = progress != null && progress.allDone

  const onboardingLayer = (
    <>
      {status === "pending" && <WelcomeOverlay firstName={landlord.first_name} />}
      {showChecklist && progress && <PremiersPas progress={progress} />}
      {justCompleted && <OnboardingComplete />}
    </>
  )

  if (!hasActiveLease) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12 lg:max-w-xl lg:gap-10">
        {status === "pending" && <WelcomeOverlay firstName={landlord.first_name} />}
        <header className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-5xl">
            Bonjour {landlord.first_name}
          </h1>
          <p className="text-sm text-muted-foreground lg:text-base">
            {status === "exploring" ? "Votre espace, à votre rythme." : "Bienvenue sur Ranti"}
          </p>
        </header>

        {showChecklist && progress && <PremiersPas progress={progress} />}
        {justCompleted && <OnboardingComplete />}

        {status === "exploring" ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 lg:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground lg:text-2xl">
              Votre registre est prêt quand vous l&apos;êtes.
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Regardez tranquillement. Le jour où vous ajoutez un bail, Ranti génère
              les échéances et prépare les quittances — rien n&apos;est obligatoire
              pour l&apos;instant.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 lg:mt-6">
              <Link
                href="/leases/new"
                className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
              >
                Créer un bail
              </Link>
              <ResumeOnboarding variant="link" />
            </div>
          </div>
        ) : (
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
        )}
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
    <main className="mx-auto w-full max-w-md space-y-8 px-6 py-10 lg:max-w-2xl lg:space-y-12 lg:py-16">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-5xl">
          Bonjour {landlord.first_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground lg:mt-2 lg:text-base">{month}</p>
      </header>

      {onboardingLayer}

      <div className="flex overflow-hidden rounded-2xl border border-border bg-card">
        <Stat label="Payé" value={summary.paid} className="text-accent" />
        <Stat label="Attendu" value={summary.expected} className="text-foreground" divider />
        <Stat label="Retard" value={summary.overdue} className="text-destructive" divider />
      </div>

      <section className="space-y-3 lg:space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground lg:text-base">À encaisser</h2>

        {summary.owed.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground lg:py-10 lg:text-base">
            Tout est encaissé. Rien à relancer.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {summary.owed.map((line) => (
              <Link
                key={line.dueId}
                href={`/leases/${line.leaseId}`}
                className="flex items-center gap-3 border-t border-border px-5 py-4 transition first:border-t-0 hover:bg-secondary/50 lg:gap-4 lg:px-6 lg:py-5"
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${line.late ? "bg-destructive" : "bg-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-foreground lg:text-lg">
                    {tenantName.get(line.tenantId) ?? "Locataire"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {unitName.get(line.unitId) ?? "Logement"} · {line.late ? "en retard" : "attendu"}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums lg:text-base ${line.late ? "text-destructive" : "text-foreground"}`}
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
          <p className="text-center text-sm text-accent lg:text-left">
            {summary.upToDateCount} locataire{summary.upToDateCount > 1 ? "s" : ""} à jour
          </p>
        ) : null}
      </section>

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
      <div className={`text-base font-semibold tabular-nums lg:text-3xl ${className}`}>{value.toLocaleString("fr-FR")}</div>
      <div className="mt-1 text-xs text-muted-foreground lg:mt-1.5 lg:text-sm">{label}</div>
    </div>
  )
}
