import { SubmitButton } from "@/components/submit-button"
import { formatFcfa } from "@/lib/format"
import type { ReminderChannel } from "@/lib/landlords"
import { scheduleReminder } from "@/lib/reminders/actions"

// « Programmer une relance » (demande du 2026-07-18) : le propriétaire choisit
// l'échéance impayée, la date d'envoi (calendrier natif, min = aujourd'hui) et
// le canal. ranti-ops envoie à la date dite. Formulaire serveur, zéro JS.

export type OpenDueOption = {
  dueId: string
  label: string // « Awa Simon · Chambre 1 · échéance du 5 août · reste 100 000 FCFA »
}

export function buildDueLabel(opts: {
  tenantName: string
  unitName: string
  dueDate: string
  remaining: number
}): string {
  const [y, m, d] = opts.dueDate.split("-").map(Number)
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  })
  return `${opts.tenantName} · ${opts.unitName} · échéance du ${dateLabel} · reste ${formatFcfa(opts.remaining)}`
}

export function ScheduleReminderForm({
  dues,
  defaultChannel,
  todayIso,
}: {
  dues: OpenDueOption[]
  defaultChannel: ReminderChannel | null
  todayIso: string
}) {
  if (dues.length === 0) return null

  const inputClass =
    "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-foreground">Programmer une relance</h2>
        <p className="mt-0.5 text-sm leading-6 text-foreground/70">
          En plus de la cadence automatique : choisissez l&apos;échéance, la date
          et le canal. Ranti l&apos;enverra ce jour-là.
        </p>
      </div>
      <form action={scheduleReminder} className="space-y-4 px-4 py-4 sm:px-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Échéance à relancer</span>
          <select name="rent_due_id" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Choisir une échéance impayée
            </option>
            {dues.map((d) => (
              <option key={d.dueId} value={d.dueId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="min-w-[150px] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Date d&apos;envoi</span>
            <input type="date" name="scheduled_for" required min={todayIso} className={inputClass} />
          </label>
          <label className="min-w-[130px] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Canal</span>
            <select name="channel" required defaultValue={defaultChannel ?? "whatsapp"} className={inputClass}>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </label>
        </div>
        <SubmitButton
          className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60"
          pendingLabel="Programmation…"
        >
          Programmer la relance
        </SubmitButton>
      </form>
    </section>
  )
}
