import Link from "next/link"
import { Alert } from "@/components/ui/alert"
import { badgeClasses } from "@/components/ui/badge"
import { getLandlordCollections } from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeaseBalances, overdueByLease } from "@/lib/ledger"
import { getLandlordDueBalances } from "@/lib/rent-dues/queries"
import { getLandlordReminders, type ReminderWithContext } from "@/lib/reminders/queries"
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
import { ReminderSettings } from "./reminder-settings"

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

export default async function RemindersPage() {
  const landlord = await requireLandlordProfile()
  const [reminders, collections, balances, leaseBalances, tenants, units] = await Promise.all([
    getLandlordReminders(landlord.id),
    getLandlordCollections(landlord.id),
    getLandlordDueBalances(landlord.id),
    getLandlordLeaseBalances(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
  ])

  const draftCount = collections.filter((c) => c.status === "draft").length

  // Calendrier des relances à venir : mêmes fenêtres (J-5, veille, jour J,
  // J+3, J+10) que la file opérateur — l'écran promet ce que ranti-ops enverra.
  const upcoming = computeUpcomingReminders(balances, overdueByLease(leaseBalances))
  const tenantNames = new Map(tenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()]))
  const unitNames = new Map(units.map((u) => [u.id, u.name]))

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
              </div>
            ))}
          </div>
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
