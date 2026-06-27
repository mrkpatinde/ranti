import Link from "next/link"
import { notFound } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { activateLease, endLease, getLease } from "@/lib/leases"
import { getLeaseRentDues } from "@/lib/rent-dues"
import { getTenant } from "@/lib/tenants"
import { getUnit } from "@/lib/units"
import type { RentDueStatus } from "@/lib/rent-dues"
import type { LeaseStatus } from "@/lib/leases"

type LeaseDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const leaseStatusLabels: Record<LeaseStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  ended: "Terminé",
  cancelled: "Annulé",
}

const dueStatusLabels: Record<RentDueStatus, string> = {
  expected: "Attendu",
  overdue: "En retard",
  paid: "Payé",
  cancelled: "Annulé",
}

const noticeLabels: Record<string, string> = {
  lease_created: "Bail créé en brouillon. Activez-le pour générer les échéances.",
  lease_activated: "Bail activé. Les échéances de loyer ont été générées.",
  lease_ended: "Bail terminé.",
  lease_updated: "Bail mis à jour.",
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function dueStatusClasses(status: RentDueStatus): string {
  switch (status) {
    case "paid":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
    case "overdue":
      return "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    case "cancelled":
      return "border-neutral-300 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
    default:
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
  }
}

export default async function LeaseDetailPage({ params, searchParams }: LeaseDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  const lease = await getLease(landlord.id, id)
  if (!lease) notFound()

  const [unit, tenant, dues] = await Promise.all([
    getUnit(landlord.id, lease.unit_id),
    getTenant(landlord.id, lease.tenant_id),
    getLeaseRentDues(landlord.id, lease.id),
  ])

  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Bail</p>
        </div>
        <Link href="/leases" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Tous les baux
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
                {formatAmount(lease.monthly_rent_amount)} / mois
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Échéance le {lease.due_day} · début {formatDate(lease.start_date)}
                {lease.end_date ? ` · fin ${formatDate(lease.end_date)}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
              {leaseStatusLabels[lease.status]}
            </span>
          </div>

          {lease.notes ? (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{lease.notes}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {lease.status === "draft" ? (
              <form action={activateLease}>
                <input type="hidden" name="id" value={lease.id} />
                <button
                  type="submit"
                  className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  Activer le bail
                </button>
              </form>
            ) : null}
            {lease.status === "active" ? (
              <form action={endLease}>
                <input type="hidden" name="id" value={lease.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
                >
                  Terminer le bail
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Échéances de loyer
          </h2>
          {dues.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {lease.status === "draft"
                ? "Aucune échéance. Activez le bail pour les générer."
                : "Aucune échéance pour ce bail."}
            </p>
          ) : (
            <div className="space-y-3">
              {dues.map((due) => (
                <article
                  key={due.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                >
                  <div>
                    <p className="font-medium text-neutral-950 dark:text-neutral-50">{formatAmount(due.amount_due)}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">échéance {formatDate(due.due_date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${dueStatusClasses(due.status)}`}>
                    {dueStatusLabels[due.status]}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
