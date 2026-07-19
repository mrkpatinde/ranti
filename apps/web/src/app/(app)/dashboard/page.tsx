import { Suspense } from "react"
import Link from "next/link"
import { formatFcfa, formatFcfaNumber } from "@/lib/format"
import { requireLandlordProfile, type Landlord, type OnboardingStatus } from "@/lib/landlords"
import { getLandlordLeases, type Lease } from "@/lib/leases"
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
import { getOnboardingProgress, type OnboardingProgress } from "@/lib/onboarding/progress"
import { buildGuidedRail } from "@/lib/onboarding/guided"
import { ResumeOnboarding } from "@/components/resume-onboarding"
import { GuidedRail } from "@/components/guided-rail"
import { WelcomeOverlay } from "./_components/welcome-overlay"
import { PremiersPas } from "./_components/premiers-pas"
import { OnboardingComplete } from "./_components/onboarding-complete"

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
  const status = landlord.onboarding_status ?? "done"
  // Prise en main guidée (welcome-flow.md), non bloquante : accueil (pending) →
  // checklist (guided) | exploration (« Passer pour l'instant »). Progression
  // dérivée des données réelles, uniquement quand le guidage est en cours,
  // chargée dans la MÊME vague que les baux (indépendantes).
  // Pré-lancement de la vague données (fluidité) : ces quatre lectures ne
  // dépendent que de landlord.id ; parties AVANT l'attente des baux, elles
  // économisent un aller-retour série complet sur le premier paint des
  // chiffres. Sans bail actif (onboarding), elles partent au rebut : quatre
  // lectures légères, coût accepté (même patron que la fiche bail sur id
  // inconnu). Le catch noop évite un « unhandled rejection » sur la branche
  // abandonnée ; l'await sous Suspense reçoit et gère toujours l'erreur.
  const dataPromises = Promise.all([
    getLandlordDueBalances(landlord.id),
    getLandlordLeaseBalances(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
  ])
  dataPromises.catch(() => {})

  const [leases, progress] = await Promise.all([
    getLandlordLeases(landlord.id),
    status === "guided" ? getOnboardingProgress(landlord.id) : null,
  ])
  const hasActiveLease = leases.some((lease) => lease.status === "active")

  if (!hasActiveLease) {
    const showChecklist = progress != null && !progress.allDone
    const justCompleted = progress != null && progress.allDone
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

  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  // Streaming (fluidité de nav) : le cadre (header « Bonjour ») peint tout de
  // suite, la zone données arrive en flux sous <Suspense>. La navigation ne
  // bloque plus sur la vague de requêtes la plus lente.
  return (
    <main className="mx-auto w-full max-w-md space-y-8 px-6 py-10 lg:max-w-2xl lg:space-y-12 lg:py-16">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-5xl">
          Bonjour {landlord.first_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground lg:mt-2 lg:text-base">{month}</p>
      </header>

      <Suspense fallback={<DashboardDataSkeleton />}>
        <DashboardData
          landlord={landlord}
          status={status}
          leases={leases}
          progress={progress}
          month={month}
          data={dataPromises}
        />
      </Suspense>
    </main>
  )
}

// Zone données du dashboard, rendue en flux : UNE vague Promise.all au lieu
// d'attentes en série avant tout paint. La progression guidée arrive déjà
// chargée du parent (même render, vague des baux).
async function DashboardData({
  landlord,
  status,
  leases,
  progress,
  month,
  data,
}: {
  landlord: Landlord
  status: OnboardingStatus
  leases: Lease[]
  progress: OnboardingProgress | null
  month: string
  data: Promise<
    [
      Awaited<ReturnType<typeof getLandlordDueBalances>>,
      Awaited<ReturnType<typeof getLandlordLeaseBalances>>,
      Awaited<ReturnType<typeof getLandlordTenants>>,
      Awaited<ReturnType<typeof getLandlordUnits>>,
    ]
  >
}) {
  // Vague pré-lancée par le parent (avant même l'attente des baux) : ici on
  // ne fait que la consommer sous Suspense.
  const [balances, leaseBalances, tenants, units] = await data
  const showChecklist = progress != null && !progress.allDone
  const justCompleted = progress != null && progress.allDone

  // Rail de la prise en main guidée (FirstRun) : dérivé de la MÊME progression
  // que la checklist (buildGuidedRail est pur — aucune requête supplémentaire).
  // Il zoome sur le seul geste à faire maintenant, sous la checklist. N'est
  // « actif » qu'en statut « guided » tant qu'il reste une étape.
  const rail = progress ? buildGuidedRail(status, progress) : null

  const summary = buildDashboardSummary(balances)
  const overview = buildLedgerOverview(leaseBalances, leases)
  const upcoming = computeUpcomingReminders(balances, overdueByLease(leaseBalances))
  const tenantName = new Map(tenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`]))
  const unitName = new Map(units.map((u) => [u.id, u.name]))

  return (
    <>
      {status === "pending" && <WelcomeOverlay firstName={landlord.first_name} />}
      {showChecklist && progress && <PremiersPas progress={progress} />}
      {rail?.active && <GuidedRail rail={rail} />}
      {justCompleted && <OnboardingComplete />}

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
    </>
  )
}

// Squelette de la zone données (mêmes tokens que loading.tsx : rien qui
// clignote fort), affiché pendant le flux Suspense.
function DashboardDataSkeleton() {
  return (
    <div aria-busy className="space-y-8 lg:space-y-12">
      <div className="h-[90px] animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none lg:h-[130px]" />
      <div className="space-y-3 lg:space-y-4">
        <div className="h-4 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-48 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      </div>
      <p className="sr-only">Chargement…</p>
    </div>
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
