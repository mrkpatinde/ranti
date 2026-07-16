// Projection de la cadence de relance (ADR-006) sur les échéances impayées :
// « la prochaine relance que Ranti enverra ». Pur, sans I/O. C'est LA cadence
// de référence du produit (ADR-022) : l'envoi est opéré par ranti-ops
// (WhatsApp, tracé dans reminder_events), qui applique ces mêmes fenêtres.
//
// On PROJETTE la cadence à partir de la date d'échéance et du jour de
// référence — on ne lit pas rent_dues.next_reminder_at (colonne dormante de
// l'ancien cron SMS, supprimé par ADR-022). Dates comparées en chaînes
// YYYY-MM-DD (sûr côté fuseau).

import type { RentDueBalance } from "@/lib/rent-dues/types"

export type UpcomingReminder = {
  dueId: string
  tenantId: string
  unitId: string
  /** Libellé de la fenêtre à venir (« Rappel J-5 », « Relance J+3 »…). */
  label: string
  /** Date à laquelle Ranti enverra cette relance (YYYY-MM-DD). */
  date: string
  /** true pour les fenêtres de retard (J+3, J+10). */
  late: boolean
}

// Points canoniques de la cadence, en jours depuis l'échéance (mêmes fenêtres
// que le calendrier affiché sur la fiche bail — contrat ADR-022).
const CHECKPOINTS: { off: number; label: string; late: boolean }[] = [
  { off: -5, label: "Rappel J-5", late: false },
  { off: -1, label: "Rappel la veille", late: false },
  { off: 0, label: "Rappel le jour J", late: false },
  { off: 3, label: "Relance J+3", late: true },
  { off: 10, label: "Relance J+10", late: true },
]

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Ajoute `off` jours à une date YYYY-MM-DD (dépassement de mois géré par Date).
function addDays(dateStr: string, off: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return ymd(new Date(y, m - 1, d + off))
}

/**
 * Pour chaque échéance non soldée, la prochaine relance prévue par la cadence
 * (première fenêtre dont la date est >= aujourd'hui). Trié par date croissante.
 * Exclut : échéances soldées, annulées, et celles dont la cadence est épuisée
 * (toutes les fenêtres sont passées — plus rien à envoyer automatiquement).
 */
export function computeUpcomingReminders(
  balances: RentDueBalance[],
  ref: Date = new Date(),
): UpcomingReminder[] {
  const today = ymd(ref)
  const out: UpcomingReminder[] = []

  for (const b of balances) {
    if (b.status === "cancelled") continue
    const remaining = Math.max(0, b.amount_due - b.amount_paid)
    if (remaining === 0) continue

    const next = CHECKPOINTS.map((cp) => ({ ...cp, date: addDays(b.due_date, cp.off) })).find(
      (cp) => cp.date >= today,
    )
    if (!next) continue

    out.push({
      dueId: b.id,
      tenantId: b.tenant_id,
      unitId: b.unit_id,
      label: next.label,
      date: next.date,
      late: next.late,
    })
  }

  return out.sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : 0))
}

// ── Garde-fou ADR-022 : rendre la panne d'envoi VISIBLE, pas seulement
// détectable. L'envoi vit dans ranti-ops ; si le service se tait alors que des
// échéances passent leurs fenêtres, /reminders doit le dire au propriétaire.

// Délai de tolérance : ranti-ops envoie sous 1-2 jours ; en deçà, silence normal.
export const REMINDER_SILENCE_GRACE_DAYS = 2

export type ReminderSilence = {
  /** Nombre d'échéances impayées dont une fenêtre est passée sans envoi. */
  silentDues: number
  /** La plus ancienne fenêtre manquée (YYYY-MM-DD). */
  oldestMissedWindow: string
}

export type SentReminderRef = {
  /** rent_due_id de l'envoi, null si inconnu. */
  dueId: string | null
  /** sent_at ISO (timestamptz). */
  sentAt: string
}

/**
 * Détecte le silence d'envoi : une échéance impayée dont la dernière fenêtre
 * de la cadence est passée depuis plus de `graceDays`, sans AUCUN envoi tracé
 * (reminders ∪ reminder_events) pour cette échéance depuis cette fenêtre.
 * Renvoie null quand tout va bien — l'écran n'affiche rien.
 */
export function detectReminderSilence(
  balances: RentDueBalance[],
  sends: SentReminderRef[],
  ref: Date = new Date(),
  graceDays: number = REMINDER_SILENCE_GRACE_DAYS,
): ReminderSilence | null {
  const cutoff = addDays(ymd(ref), -graceDays)
  let silentDues = 0
  let oldestMissedWindow: string | null = null

  for (const b of balances) {
    if (b.status !== "expected" && b.status !== "overdue") continue
    if (Math.max(0, b.amount_due - b.amount_paid) === 0) continue

    // Dernière fenêtre de la cadence déjà « due » (passée d'au moins graceDays).
    const lastActionable = CHECKPOINTS.map((cp) => addDays(b.due_date, cp.off))
      .filter((date) => date <= cutoff)
      .at(-1)
    if (!lastActionable) continue

    const hasSend = sends.some(
      (s) => s.dueId === b.id && s.sentAt.slice(0, 10) >= lastActionable,
    )
    if (hasSend) continue

    silentDues += 1
    if (oldestMissedWindow === null || lastActionable < oldestMissedWindow) {
      oldestMissedWindow = lastActionable
    }
  }

  return silentDues > 0 && oldestMissedWindow !== null
    ? { silentDues, oldestMissedWindow }
    : null
}
