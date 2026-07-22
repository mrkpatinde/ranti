import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { badgeClasses, type BadgeVariant } from "@/components/ui/badge"
import { formatFcfa } from "@/lib/format"
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
import { buildReminderWaLink } from "@/lib/reminders/whatsapp"
import { getLeaseBalance } from "@/lib/ledger"
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function dueStatusVariant(status: RentDueStatus): BadgeVariant {
  switch (status) {
    case "paid":
      return "success"
    case "overdue":
      return "error"
    case "cancelled":
      return "neutral"
    default:
      return "accent"
  }
}

// Cadence appliquée par Ranti à partir de l'échéance (ADR-006 : la fiche bail
// affiche les règles de rappel/relance). Mêmes fenêtres que schedule.ts —
// l'envoi est opéré par ranti-ops (ADR-022). Lecture seule au MVP.
const REMINDER_SCHEDULE: { when: string; what: string; late: boolean }[] = [
  { when: "5 jours avant l'échéance", what: "Premier rappel — le loyer approche", late: false },
  { when: "La veille de l'échéance", what: "Rappel — le loyer est dû demain", late: false },
  { when: "Le jour de l'échéance", what: "Rappel — le loyer est dû aujourd'hui", late: false },
  { when: "Dès 3 jours de retard", what: "Relance — régulariser le loyer", late: true },
  { when: "À 10 jours de retard", what: "Relance — contacter le propriétaire", late: true },
]

export default function LeaseDetailPage({ params, searchParams }: LeaseDetailPageProps) {
  // Streaming (fluidité de nav) : le cadre (header « Bail ») peint tout de
  // suite, le contenu arrive en flux sous <Suspense> au lieu de bloquer la
  // navigation sur les requêtes du bail.
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Bail</p>
        </div>
        <Link href="/leases" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Tous les baux</Link>
      </header>

      <Suspense fallback={<LeaseDetailSkeleton />}>
        <LeaseDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function LeaseDetail({ params, searchParams }: LeaseDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  // UNE seule vague : les requêtes qui ne dépendent que de l'id (échéances,
  // solde) partent tout de suite, en parallèle du bail lui-même.
  // unit/tenant se chaînent sur le bail, les relances sur les échéances : tout
  // converge dans le même Promise.all. Sur un id inconnu, les requêtes id-only
  // reviennent vides (RLS) et notFound() tombe après la vague : acceptable pour
  // une page authentifiée.
  const leasePromise = getLease(landlord.id, id)
  const duesPromise = getLeaseDueBalances(landlord.id, id)
  const [lease, unit, tenant, dues, balance, reminders] = await Promise.all([
    leasePromise,
    leasePromise.then((l) => (l ? getUnit(landlord.id, l.unit_id) : null)),
    leasePromise.then((l) => (l ? getTenant(landlord.id, l.tenant_id) : null)),
    duesPromise,
    getLeaseBalance(landlord.id, id),
    duesPromise.then((ds) => getLeaseReminders(landlord.id, ds.map((d) => d.id))),
  ])
  if (!lease) notFound()

  // Object.hasOwn : un ?notice=__proto__ forgé renverrait Object.prototype
  // (truthy), invalide comme enfant JSX, et ferait tomber la page entière.
  const notice = sp?.notice && Object.hasOwn(noticeLabels, sp.notice) ? noticeLabels[sp.notice] : null

  // Ferme la boucle dashboard → retard → action : le CTA « Encaisser » mène à
  // /collections/new avec ce bail présélectionné dès qu'il reste un impayé.
  const hasUnpaidDues = dues.some(
    (due) => (due.status === "expected" || due.status === "overdue") && due.amount_due - due.amount_paid > 0,
  )

  // Solde du compte courant (grand livre, ADR-023) — la même lentille que le
  // dashboard : plus de fiche bail qui contredit la liste des impayés.
  const ledgerOverdue = Number(balance?.overdue_amount ?? 0)
  const outstanding = Math.max(0, -Number(balance?.certain_balance ?? 0))
  const expectedSoon = Math.max(0, outstanding - ledgerOverdue)
  const advance = Math.max(0, Number(balance?.certain_balance ?? 0))
  const pendingCredits = Number(balance?.pending_credits ?? 0)

  // Relance manuelle « préparée sans envoi auto » (ADR-006 MVP) : lien wa.me
  // pré-rempli. Garde compte courant (ADR-023) : une relance de RETARD n'a de
  // sens que si le grand livre porte un impayé — le montant est celui du
  // compte, pas d'une échéance isolée. Sinon, seul un rappel pré-échéance
  // reste proposé.
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const firstUnpaid = dues.find(
    (d) => d.status !== "cancelled" && d.amount_due - d.amount_paid > 0,
  )
  const relanceLate = ledgerOverdue > 0
  const relanceDue = relanceLate
    ? firstUnpaid
    : firstUnpaid && firstUnpaid.due_date >= todayStr
      ? firstUnpaid
      : undefined
  const relanceWaLink =
    lease.status === "active" && tenant?.phone && relanceDue
      ? buildReminderWaLink({
          phone: tenant.phone,
          tenantName: `${tenant.first_name} ${tenant.last_name}`,
          amount: relanceLate
            ? ledgerOverdue
            : Math.max(0, relanceDue.amount_due - relanceDue.amount_paid),
          dueDate: relanceDue.due_date,
          late: relanceLate,
          // Tout premier message à ce locataire : Ranti se présente et
          // explique le processus (décision 2026-07-18).
          introFrom:
            reminders.length === 0
              ? `${landlord.first_name} ${landlord.last_name}`.trim()
              : null,
        })
      : null

  return (
    <section className="flex flex-1 flex-col gap-8 py-10">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">{sp.error}</p> : null}

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl text-foreground">{formatFcfa(lease.monthly_rent_amount)} / mois</h1>
              <p className="mt-1 text-sm text-muted-foreground">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Échéance le {lease.due_day} · début {formatDate(lease.start_date)}{lease.end_date ? ` · fin ${formatDate(lease.end_date)}` : ""}</p>
            </div>
            <span className={badgeClasses("neutral")}>{leaseStatusLabels[lease.status]}</span>
          </div>

          {balance ? (
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Compte du bail : </span>
              {ledgerOverdue > 0 ? (
                <span className="font-semibold tabular-nums text-destructive">
                  {formatFcfa(ledgerOverdue)} en retard
                </span>
              ) : outstanding > 0 ? (
                <span className="font-medium tabular-nums text-foreground">
                  {formatFcfa(outstanding)} attendus
                </span>
              ) : advance > 0 ? (
                <span className="font-medium tabular-nums text-accent">
                  avance de {formatFcfa(advance)}
                </span>
              ) : (
                <span className="font-medium text-accent">à jour</span>
              )}
              {ledgerOverdue > 0 && expectedSoon > 0 ? (
                <span className="text-muted-foreground"> · {formatFcfa(expectedSoon)} attendus</span>
              ) : null}
              {pendingCredits > 0 ? (
                <span className="text-muted-foreground"> · {formatFcfa(pendingCredits)} à confirmer</span>
              ) : null}
            </p>
          ) : null}

          {lease.notes ? <p className="mt-3 text-sm text-muted-foreground">{lease.notes}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {lease.status === "draft" ? (
              <>
                <Link href={`/leases/${lease.id}/edit`} className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary">Modifier le bail</Link>
                <form action={activateLease}>
                  <input type="hidden" name="id" value={lease.id} />
                  <SubmitButton className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60">Activer et générer les loyers</SubmitButton>
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
                      <p className="font-medium text-foreground">{formatFcfa(due.amount_due)}</p>
                      <p className="text-sm text-muted-foreground">échéance {formatDate(due.due_date)}</p>
                      {due.amount_paid > 0 && remaining > 0 ? (
                        <p className="text-sm text-muted-foreground">restant {formatFcfa(remaining)}</p>
                      ) : null}
                    </div>
                    <span className={badgeClasses(dueStatusVariant(due.status))}>{dueStatusLabels[due.status]}</span>
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

                {relanceWaLink ? (
                  <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4">
                    <p className="text-sm leading-6 text-foreground/80">
                      Besoin de relancer vous-même maintenant ? Le message est prêt — vous le
                      relisez et l&apos;envoyez d&apos;un tap.
                    </p>
                    <a
                      href={relanceWaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-full border border-primary/30 bg-card px-5 py-3 text-sm font-semibold text-primary transition hover:border-primary"
                    >
                      Relancer sur WhatsApp
                    </a>
                  </div>
                ) : null}
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
                    <span className={badgeClasses(reminder.status === "failed" ? "error" : "success")}>
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
  )
}

// Squelette du contenu bail (mêmes tokens que loading.tsx : rien qui clignote
// fort) : carte résumé + lignes d'échéances, affiché pendant le flux Suspense.
function LeaseDetailSkeleton() {
  return (
    <section aria-busy className="flex flex-1 flex-col gap-8 py-10">
      <div className="h-44 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <div className="space-y-3">
        <div className="h-5 w-44 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      </div>
      <p className="sr-only">Chargement…</p>
    </section>
  )
}
