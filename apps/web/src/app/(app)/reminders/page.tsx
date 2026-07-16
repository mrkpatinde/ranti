import Link from "next/link"
import { Alert } from "@/components/ui/alert"
import { badgeClasses } from "@/components/ui/badge"
import { getLandlordCollections } from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordDueBalances } from "@/lib/rent-dues/queries"
import { getLandlordReminders, type ReminderWithContext } from "@/lib/reminders/queries"
import { detectReminderSilence, REMINDER_SILENCE_GRACE_DAYS } from "@/lib/reminders/schedule"
import {
  reminderChannelLabels,
  reminderStatusLabels,
  reminderTemplateLabels,
} from "@/lib/reminders/labels"

// Relances automatiques : Ranti relance les locataires à partir du bail.
// Cet écran montre ce que Ranti a fait pour le propriétaire — jamais
// « envoyez vos relances ».

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

export default async function RemindersPage() {
  const landlord = await requireLandlordProfile()
  const [reminders, collections, balances] = await Promise.all([
    getLandlordReminders(landlord.id),
    getLandlordCollections(landlord.id),
    getLandlordDueBalances(landlord.id),
  ])

  const draftCount = collections.filter((c) => c.status === "draft").length

  // Garde-fou ADR-022 : l'envoi vit dans ranti-ops ; si des fenêtres passent
  // sans envoi tracé, on le dit — plutôt qu'un silence qui ressemble à un bug.
  const silence = detectReminderSilence(
    balances,
    reminders.map((r) => ({ dueId: r.rent_due?.id ?? null, sentAt: r.sent_at })),
  )

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl text-foreground">
          Relances
        </h1>
        <p className="text-sm leading-6 text-foreground/70">
          Ranti relance automatiquement vos locataires à partir du bail : avant
          l&apos;échéance, le jour J, puis en cas de retard. Voici ce qui a été envoyé.
        </p>
      </header>

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

      <section className="mt-6 space-y-3">
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
