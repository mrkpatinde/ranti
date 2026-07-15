import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { activateLease, endLease, getLease } from "@/lib/leases"
import { ArchiveLeaseButton } from "./archive-lease-button"
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
      return "border-primary/20 bg-secondary text-foreground"
    case "overdue":
      return "border-red-300 bg-red-50 text-red-900"
    case "cancelled":
      return "border-border bg-background text-foreground/70"
    default:
      return "border-accent/50 bg-accent/10 text-accent"
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Bail</p>
        </div>
        <Link href="/leases" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Tous les baux</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">{sp.error}</p> : null}

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl text-foreground">{formatAmount(lease.monthly_rent_amount)} / mois</h1>
              <p className="mt-1 text-sm text-muted-foreground">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Échéance le {lease.due_day} · début {formatDate(lease.start_date)}{lease.end_date ? ` · fin ${formatDate(lease.end_date)}` : ""}</p>
            </div>
            <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80">{leaseStatusLabels[lease.status]}</span>
          </div>

          {lease.notes ? <p className="mt-3 text-sm text-muted-foreground">{lease.notes}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {lease.status === "draft" ? (
              <>
                <Link href={`/leases/${lease.id}/edit`} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary">Modifier le bail</Link>
                <form action={activateLease}>
                  <input type="hidden" name="id" value={lease.id} />
                  <SubmitButton className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">Activer et générer les loyers</SubmitButton>
                </form>
                <p className="w-full text-sm leading-6 text-muted-foreground">ⓘ L&apos;activation crée les échéances mensuelles depuis la date de début et met le suivi en route : rappels avant l&apos;échéance, relances en cas de retard, quittance à chaque paiement confirmé.</p>
              </>
            ) : null}
            {lease.status === "active" ? (
              <div className="w-full space-y-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
                <p className="text-sm leading-6 text-foreground/80">
                  Archiver le bail arrête la génération des échéances et les relances automatiques.
                  L&apos;historique (échéances, paiements, quittances) reste conservé dans le registre.
                  <strong className="text-destructive"> Action définitive</strong> — pour reloger, créez un nouveau bail.
                </p>
                <ArchiveLeaseButton leaseId={lease.id} action={endLease} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Échéances de loyer</h2>
          {dues.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lease.status === "draft" ? "Aucune échéance. Activez le bail pour les générer." : "Aucune échéance pour ce bail."}</p>
          ) : (
            <div className="space-y-3">
              {dues.map((due) => (
                <article key={due.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{formatAmount(due.amount_due)}</p>
                    <p className="text-sm text-muted-foreground">échéance {formatDate(due.due_date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${dueStatusClasses(due.status)}`}>{dueStatusLabels[due.status]}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
