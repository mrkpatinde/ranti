import Link from "next/link"
import { Alert } from "@/components/ui/alert"
import { badgeClasses } from "@/components/ui/badge"
import { getLandlordCollections } from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeaseBalances, getLandlordOpenCharges, overdueByLease } from "@/lib/ledger"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordDueBalances } from "@/lib/rent-dues/queries"
import {
  getLandlordReminders,
  getScheduledReminders,
  type ReminderWithContext,
} from "@/lib/reminders/queries"
import {
  computeUpcomingReminders,
  detectReminderSilence,
  REMINDER_SILENCE_GRACE_DAYS,
} from "@/lib/reminders/schedule"
import {
  reminderChannelLabels,
  reminderStatusLabels,
  reminderTemplateLabels,
} from "@/lib/reminders/labels"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import { cancelScheduledReminder } from "@/lib/reminders/actions"
import { buildReminderWaLink } from "@/lib/reminders/whatsapp"
import { ReminderSettings } from "./reminder-settings"
import { buildChargeLabel, buildDueLabel, ScheduleReminderForm } from "./schedule-form"

// Relances automatiques : Ranti relance les locataires à partir du bail.
// Cet écran porte les RÉGLAGES du propriétaire (canal, moment, message par
// défaut — demande du 2026-07-18), le calendrier des relances À VENIR, puis
// l'historique de ce que Ranti a envoyé — jamais « envoyez vos relances ».

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

function tenantName(reminder: ReminderWithContext): string {
  const tenant = reminder.rent_due?.tenant
  if (!tenant) return "Locataire"
  return `${tenant.first_name} ${tenant.last_name}`.trim()
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>
}) {
  const landlord = await requireLandlordProfile()
  const sp = await searchParams
  const [reminders, collections, balances, leaseBalances, tenants, units, scheduled, charges, leases] =
    await Promise.all([
      getLandlordReminders(landlord.id),
      getLandlordCollections(landlord.id),
      getLandlordDueBalances(landlord.id),
      getLandlordLeaseBalances(landlord.id),
      getLandlordTenants(landlord.id),
      getLandlordUnits(landlord.id),
      getScheduledReminders(landlord.id),
      getLandlordOpenCharges(landlord.id),
      getLandlordLeases(landlord.id),
    ])

  const draftCount = collections.filter((c) => c.status === "draft").length

  // Calendrier des relances à venir : mêmes fenêtres (J-5, veille, jour J,
  // J+3, J+10) que la file opérateur — l'écran promet ce que ranti-ops enverra.
  const upcoming = computeUpcomingReminders(balances, overdueByLease(leaseBalances))
  const tenantNames = new Map(tenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()]))
  const tenantPhones = new Map(tenants.map((t) => [t.id, t.phone]))
  const unitNames = new Map(units.map((u) => [u.id, u.name]))
  const dueById = new Map(balances.map((b) => [b.id, b]))

  const leaseById = new Map(leases.map((l) => [l.id, l]))
  const chargeById = new Map(charges.map((c) => [c.id, c]))
  // Baux portant un impayé consolidé au grand livre (charges comprises,
  // ADR-023) : seuls leurs débits sont relançables.
  const overdueLeases = new Set(
    leaseBalances.filter((lb) => lb.overdue_amount > 0).map((lb) => lb.lease_id),
  )

  // Cibles proposées : échéances de loyer ouvertes + charges VALIDÉES des
  // baux en impayé. Le message ops distingue toujours loyer et charge.
  const scheduleTargets = [
    ...balances
      .filter((b) => b.status !== "paid" && b.status !== "cancelled" && b.amount_due - b.amount_paid > 0)
      .map((b) => ({
        value: `due:${b.id}`,
        label: buildDueLabel({
          tenantName: tenantNames.get(b.tenant_id) ?? "Locataire",
          unitName: unitNames.get(b.unit_id) ?? "Logement",
          dueDate: b.due_date,
          remaining: b.amount_due - b.amount_paid,
        }),
      })),
    ...charges
      .filter((c) => overdueLeases.has(c.lease_id))
      .map((c) => {
        const lease = leaseById.get(c.lease_id)
        return {
          value: `charge:${c.id}`,
          label: buildChargeLabel({
            tenantName: lease ? (tenantNames.get(lease.tenant_id) ?? "Locataire") : "Locataire",
            unitName: lease ? (unitNames.get(lease.unit_id) ?? "Logement") : "Logement",
            type: c.type,
            label: c.label,
            amount: c.amount,
          }),
        }
      }),
  ]

  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  // Garde-fou ADR-022 : l'envoi vit dans ranti-ops ; si des fenêtres passent
  // sans envoi tracé, on le dit — plutôt qu'un silence qui ressemble à un bug.
  // Une fenêtre de retard n'est « attendue » que si le bail porte un impayé
  // au grand livre (garde compte courant, ADR-023).
  const silence = detectReminderSilence(
    balances,
    reminders.map((r) => ({ dueId: r.rent_due?.id ?? null, sentAt: r.sent_at })),
    overdueByLease(leaseBalances),
  )

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl text-foreground">
          Relances
        </h1>
        <p className="text-sm leading-6 text-foreground/70">
          Ranti relance automatiquement vos locataires à partir du bail : avant
          l&apos;échéance, le jour J, puis en cas de retard. Vous choisissez le
          canal et le moment ; le jour d&apos;échéance vient de chaque bail.
        </p>
      </header>

      <ReminderSettings
        initialEnabled={landlord.reminders_enabled}
        initialChannel={landlord.reminder_channel}
        initialMoment={landlord.reminder_moment}
      />

      {sp?.error ? (
        <Alert variant="warning" className="mt-4">
          {sp.error}
        </Alert>
      ) : null}
      {sp?.notice === "reminder_scheduled" ? (
        <div className="mt-4 rounded-2xl border border-accent/25 bg-secondary px-4 py-3 text-sm text-foreground">
          Relance programmée. Elle apparaît ci-dessous et Ranti l&apos;enverra à la date choisie.
        </div>
      ) : null}

      <ScheduleReminderForm
        targets={scheduleTargets}
        defaultChannel={landlord.reminder_channel}
        todayIso={todayIso}
      />

      {scheduled.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Relances programmées par vous</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {scheduled.map((s) => {
              const due = s.rent_due_id ? dueById.get(s.rent_due_id) : undefined
              const charge = s.charge_id ? chargeById.get(s.charge_id) : undefined
              const chargeLease = charge ? leaseById.get(charge.lease_id) : undefined
              const who = due
                ? (tenantNames.get(due.tenant_id) ?? "Locataire")
                : chargeLease
                  ? (tenantNames.get(chargeLease.tenant_id) ?? "Locataire")
                  : "Locataire"
              const what = due
                ? (unitNames.get(due.unit_id) ?? "Logement")
                : charge
                  ? `${charge.type === "reparation" ? "Réparation" : "Frais"} « ${charge.label} »`
                  : "Logement"
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0 sm:px-5"
                >
                  <span aria-hidden className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-foreground">{who}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {what} · {s.channel === "whatsapp" ? "WhatsApp" : "SMS"} · le {formatShortDate(s.scheduled_for)}
                    </p>
                  </div>
                  <form action={cancelScheduledReminder}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      Annuler
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {silence ? (
        <Alert variant="warning" className="mt-6">
          {silence.silentDues === 1
            ? "1 échéance a passé sa fenêtre de relance sans envoi"
            : `${silence.silentDues} échéances ont passé leur fenêtre de relance sans envoi`}
          {" "}depuis plus de {REMINDER_SILENCE_GRACE_DAYS} jours. Vous pouvez relancer
          vous-même depuis la fiche du bail (bouton WhatsApp) — et prévenir
          l&apos;assistance si cela persiste.
        </Alert>
      ) : null}

      {draftCount > 0 && (
        <Link
          href="/collections"
          className="mt-6 block rounded-2xl border border-primary/30 bg-secondary px-4 py-3 transition hover:bg-secondary/70"
        >
          <p className="text-sm font-semibold text-foreground">
            {draftCount === 1
              ? "1 déclaration de paiement à valider"
              : `${draftCount} déclarations de paiement à valider`}
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground/70">
            Un locataire a déclaré avoir payé. Vérifiez et confirmez l&apos;encaissement.
          </p>
        </Link>
      )}

      {upcoming.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">À venir</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {upcoming.map((r) => (
              <div
                key={r.dueId}
                className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0 sm:px-5"
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${r.late ? "bg-destructive" : "bg-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-foreground">
                    {tenantNames.get(r.tenantId) ?? "Locataire"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {unitNames.get(r.unitId) ?? "Logement"} · {r.label}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatShortDate(r.date)}
                </span>
                {(() => {
                  const due = dueById.get(r.dueId)
                  const phone = tenantPhones.get(r.tenantId)
                  if (!due || !phone) return null
                  const wa = buildReminderWaLink({
                    phone,
                    tenantName: tenantNames.get(r.tenantId) ?? null,
                    amount: Math.max(0, due.amount_due - due.amount_paid),
                    dueDate: due.due_date,
                    late: r.late,
                  })
                  if (!wa) return null
                  return (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                    >
                      Relancer maintenant
                    </a>
                  )
                })()}
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            « Relancer maintenant » ouvre WhatsApp avec le message par défaut
            pré-rempli : vous relisez et envoyez vous-même.
          </p>
        </section>
      ) : null}

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Historique</h2>
        {reminders.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Aucune relance envoyée pour l&apos;instant.
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground/70">
              Dès qu&apos;un bail actif a une échéance qui approche, Ranti prévient le
              locataire pour vous. Rien à faire de votre côté.
            </p>
          </div>
        ) : (
          reminders.map((reminder) => {
            const due = reminder.rent_due
            return (
              <article
                key={reminder.id}
                className="rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-foreground">
                      {tenantName(reminder)}
                      {due?.unit?.name ? (
                        <span className="text-foreground/60"> — {due.unit.name}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground/70">
                      {reminderTemplateLabels[reminder.template] ?? reminder.template}
                      {due ? ` · Loyer de ${formatMonth(due.period_start)}` : ""}
                    </p>
                  </div>
                  <span className={badgeClasses(reminder.status === "failed" ? "error" : "success")}>
                    {reminderStatusLabels[reminder.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {reminderChannelLabels[reminder.channel] ?? reminder.channel} ·{" "}
                  {formatDate(reminder.sent_at)}
                  {due ? ` · échéance du ${formatDate(due.due_date)}` : ""}
                </p>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}
