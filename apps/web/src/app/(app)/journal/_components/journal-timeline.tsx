import Link from "next/link"
import type { JournalEvent } from "@/lib/journal"
import { buildTenantPaymentWaLink } from "@/lib/journal/whatsapp"
import { formatFcfa } from "@/lib/format"
import { AllocateAffordance } from "./allocate-affordance"

// Timeline chronologique (ADR-014), esthétique « Granola » : colonne date à
// chiffre serif, filet vertical coloré par nature d'évènement, séparation
// pointillée entre les jours. Rendu serveur ; seule l'affordance d'allocation
// des Fast-Log non alloués est cliente.

// Détail derrière chaque ligne (les écrans de gestion sont le détail du journal).
const DETAIL_HREF: Record<JournalEvent["ref_table"], (id: string) => string> = {
  leases: (id) => `/leases/${id}`,
  rent_dues: () => `/collections`,
  rent_receptions: () => `/collections`,
  receipts: (id) => `/receipts/${id}`,
  reminders: () => `/reminders`,
  reminder_events: () => `/reminders`,
}

/** Couleur du filet vertical selon la nature de l'évènement. */
function accentClass(event: JournalEvent): string {
  if (event.event_type === "rent_reception") {
    // Vert émeraude = encaissement alloué ; ambre = Fast-Log non alloué.
    return event.allocated === false
      ? "border-amber-500/70"
      : "border-emerald-500/70"
  }
  // Événement système (bail, échéance, quittance, relance).
  return "border-border"
}

interface DayGroup {
  day: string
  dayNumber: string
  month: string
  weekday: string
  items: JournalEvent[]
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function groupByDay(events: JournalEvent[]): DayGroup[] {
  const groups: DayGroup[] = []
  let current: DayGroup | null = null
  for (const e of events) {
    const key = dayKey(e.occurred_at)
    if (!current || current.day !== key) {
      const d = new Date(e.occurred_at)
      current = {
        day: key,
        dayNumber: d.toLocaleDateString("fr-FR", { day: "numeric" }),
        month: d.toLocaleDateString("fr-FR", { month: "long" }),
        weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }),
        items: [],
      }
      groups.push(current)
    }
    current.items.push(e)
  }
  return groups
}

export function JournalTimeline({
  events,
}: {
  events: JournalEvent[]
}): React.JSX.Element {
  const groups = groupByDay(events)

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        Le journal est vide. Vos loyers, encaissements et relances apparaîtront ici.
      </p>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-2 sm:p-4">
      {groups.map((group, index) => (
        <div
          key={group.day}
          className={[
            "flex gap-5 px-3 py-5 sm:gap-8 sm:px-4",
            index > 0 ? "border-t border-dashed border-border/50" : "",
          ].join(" ")}
        >
          {/* Colonne date — largeur fixe */}
          <div className="flex w-16 shrink-0 items-baseline gap-2 sm:w-24">
            <span className="font-display text-4xl font-light leading-none tabular-nums text-foreground sm:text-5xl">
              {group.dayNumber}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs capitalize text-muted-foreground">
                {group.month}
              </span>
              <span className="text-xs capitalize text-muted-foreground/70">
                {group.weekday}
              </span>
            </div>
          </div>

          {/* Colonne contenu */}
          <ol className="flex min-w-0 flex-1 flex-col gap-2.5">
            {group.items.map((event) => (
              <EventRow
                key={`${event.ref_table}:${event.ref_id}`}
                event={event}
              />
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function EventRow({ event }: { event: JournalEvent }): React.JSX.Element {
  const href = DETAIL_HREF[event.ref_table]?.(event.ref_id) ?? "#"
  const isPayment = event.event_type === "rent_reception"
  const unallocated = isPayment && event.allocated === false

  // Notification WhatsApp sortante (étape 6) : lien wa.me pré-rempli vers le
  // locataire, uniquement sur un encaissement doté d'un montant et d'un numéro.
  const waLink =
    isPayment && event.counterparty_phone && event.amount != null
      ? buildTenantPaymentWaLink({
          phone: event.counterparty_phone,
          tenantName: event.counterparty,
          amount: event.amount,
        })
      : null

  // Fast-Log non alloué : titre dédié « Encaissement à affecter — [Montant] FCFA ».
  const title = unallocated
    ? `Encaissement à affecter${event.amount != null ? ` — ${formatFcfa(event.amount)}` : ""}`
    : event.label

  const secondary =
    [event.counterparty, event.unit_label].filter(Boolean).join(" · ") ||
    (event.reference ? "" : "—")

  return (
    <li className={`border-l-2 pl-4 ${accentClass(event)}`}>
      <Link
        href={href}
        className="group flex items-baseline justify-between gap-4 py-1"
      >
        <div className="min-w-0">
          <p
            className={[
              "truncate text-[15px] font-medium leading-snug",
              unallocated ? "text-amber-600 dark:text-amber-300" : "text-foreground",
            ].join(" ")}
          >
            {title}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {secondary}
            {event.reference ? ` · Réf ${event.reference}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {!unallocated && event.amount != null ? (
            <span
              className={
                isPayment
                  ? "text-sm font-semibold tabular-nums text-foreground"
                  : "text-sm tabular-nums text-muted-foreground"
              }
            >
              {isPayment ? "+ " : ""}
              {formatFcfa(event.amount)}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Affordances : notifier le locataire (WhatsApp) et affecter un Fast-Log. */}
      {waLink || unallocated ? (
        <div className="flex items-center gap-4 pb-1">
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              aria-label="Notifier le locataire du paiement reçu sur WhatsApp"
            >
              Notifier sur WhatsApp
            </a>
          ) : null}
          {unallocated ? <AllocateAffordance refId={event.ref_id} /> : null}
        </div>
      ) : null}
    </li>
  )
}
