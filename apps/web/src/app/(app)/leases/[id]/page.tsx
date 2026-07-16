import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { activateLease, endLease, getLease } from "@/lib/leases"
import { ArchiveLeaseButton } from "./archive-lease-button"
import { getLeaseDueBalances } from "@/lib/rent-dues"
import { getLeaseReminders } from "@/lib/reminders/queries"
import {
  reminderChannelLabels,
  reminderStatusLabels,
  reminderTemplateLabels,
} from "@/lib/reminders/labels"
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
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "cancelled":
      return "border-border bg-background text-foreground/70"
    default:
      return "border-accent/50 bg-accent/10 text-accent"
  }
}

// Cadence appliquée par Ranti à partir de l'échéance (ADR-006 : la fiche bail
// affiche les règles de rappel/relance). Miroir des fenêtres du cron
// (getReminderTemplate) — lecture seule, non configurable au MVP.
const REMINDER_SCHEDULE: { when: string; what: string; late: boolean }[] = [
  { when: "5 jours avant l'échéance", what: "Premier rappel — le loyer approche", late: false },
  { when: "La veille de l'échéance", what: "Rappel — le loyer est dû demain", late: false },
  { when: "Le jour de l'échéance", what: "Rappel — le loyer est dû aujourd'hui", late: false },
  { when: "Dès 3 jours de retard", what: "Relance — régulariser le loyer", late: true },
  { when: "À 10 jours de retard", what: "Relance — contacter le propriétaire", late: true },
]

export default async function LeaseDetailPage({ params, searchParams }: LeaseDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  const lease = await getLease(landlord.id, id)
  if (!lease) notFound()

  const [unit, tenant, dues] = await Promise.all([
    getUnit(landlord.id, lease.unit_id),
    getTenant(landlord.id, lease.tenant_id),
    getLeaseDueBalances(landlord.id, lease.id),
  ])
  // Fil des relances de CE bail (filtré sur ses échéances) : relie retard et
  // relances au même endroit. Dépend des échéances → chargé après.
  const reminders = await getLeaseReminders(landlord.id, dues.map((d) => d.id))

  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  // Ferme la boucle dashboard → retard → action : le CTA « Encaisser » mène à
  // /collections/new avec ce bail présélectionné dès qu'il reste un impayé.
  const hasUnpaidDues = dues.some(
    (due) => (due.status === "expected" || due.status === "overdue") && due.amount_due - due.amount_paid > 0,
  )

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
        {sp?.error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">{sp.error}</p> : null}

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
            {lease.status === "active" && hasUnpaidDues ? (
              <Link
                href={`/collections/new?lease_id=${lease.id}`}
                className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
              >
                Encaisser un paiement reçu
              </Link>
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
              {dues.map((due) => {
                const remaining = Math.max(0, due.amount_due - due.amount_paid)
                return (
                  <article key={due.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{formatAmount(due.amount_due)}</p>
                      <p className="text-sm text-muted-foreground">échéance {formatDate(due.due_date)}</p>
                      {due.amount_paid > 0 && remaining > 0 ? (
                        <p className="text-sm text-muted-foreground">restant {formatAmount(remaining)}</p>
                      ) : null}
                    </div>
                    <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${dueStatusClasses(due.status)}`}>{dueStatusLabels[due.status]}</span>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {lease.status === "draft" || lease.status === "active" || reminders.length > 0 ? (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Rappels &amp; relances</h2>

            {lease.status === "draft" || lease.status === "active" ? (
              <>
                <p className="text-sm leading-6 text-muted-foreground">
                  {lease.status === "draft"
                    ? "À l'activation du bail, Ranti préviendra automatiquement votre locataire — vous n'avez rien à envoyer. Le calendrier :"
                    : "Ranti prévient automatiquement votre locataire à partir du bail — vous n'avez rien à envoyer. Le calendrier :"}
                </p>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {REMINDER_SCHEDULE.map((step) => (
                    <div key={step.when} className="flex items-start gap-3 border-t border-border px-4 py-3 first:border-t-0">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${step.late ? "bg-destructive" : "bg-accent"}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{step.when}</p>
                        <p className="text-sm text-muted-foreground">{step.what}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {lease.status !== "draft" ? (
              <>
                <h3 className="pt-1 text-sm font-semibold text-muted-foreground">Envoyées</h3>
                {reminders.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Aucune relance envoyée pour ce bail pour l&apos;instant.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reminders.map((reminder) => (
                  <article key={reminder.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {reminderTemplateLabels[reminder.template] ?? reminder.template}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {reminderChannelLabels[reminder.channel] ?? reminder.channel} · {formatDate(reminder.sent_at)}
                        {reminder.rent_due ? ` · échéance du ${formatDate(reminder.rent_due.due_date)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        reminder.status === "failed"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-primary/20 bg-secondary text-foreground"
                      }`}
                    >
                      {reminderStatusLabels[reminder.status]}
                    </span>
                  </article>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
