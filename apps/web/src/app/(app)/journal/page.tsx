import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getJournalFeed, countThisMonth, type JournalEvent } from "@/lib/journal"
import { formatFcfa } from "@/lib/format"
import { SmsIngestionZone } from "../dashboard/_components/sms-ingestion-zone"
import { AllocateAffordance } from "./_components/allocate-affordance"

export const metadata = { title: "Journal — Ranti" }

// Détail de chaque type d'événement derrière sa ligne (ADR-014 : les écrans de
// gestion deviennent le détail du journal).
const DETAIL_HREF: Record<JournalEvent["ref_table"], (id: string) => string> = {
  leases: (id) => `/leases/${id}`,
  rent_dues: () => `/collections`,
  rent_receptions: () => `/collections`,
  receipts: (id) => `/receipts/${id}`,
  reminders: () => `/reminders`,
  reminder_events: () => `/reminders`,
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function groupByDay(events: JournalEvent[]): Array<{ day: string; items: JournalEvent[] }> {
  const groups: Array<{ day: string; items: JournalEvent[] }> = []
  let current: { day: string; items: JournalEvent[] } | null = null
  for (const e of events) {
    const key = dayKey(e.occurred_at)
    if (!current || current.day !== key) {
      current = { day: key, items: [] }
      groups.push(current)
    }
    current.items.push(e)
  }
  return groups
}

export default async function JournalPage() {
  await requireLandlordProfile()
  const events = await getJournalFeed()
  const monthCount = countThisMonth(events)
  const groups = groupByDay(events)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* En-tête : titre sobre + résumé discret, zone de collage à côté */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Ranti</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthCount > 0
              ? `${monthCount} évènement${monthCount > 1 ? "s" : ""} ce mois-ci`
              : "Aucun évènement ce mois-ci"}
          </p>
        </div>
        <div className="sm:w-80 sm:shrink-0">
          <SmsIngestionZone />
        </div>
      </header>

      {/* Le flux */}
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          Le journal est vide. Vos loyers, encaissements et relances apparaîtront ici.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.day}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatDayLabel(group.day)}
              </h2>
              <ol className="relative space-y-px border-l border-border pl-5">
                {group.items.map((event) => (
                  <EventRow key={`${event.ref_table}:${event.ref_id}`} event={event} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: JournalEvent }): React.JSX.Element {
  const href = DETAIL_HREF[event.ref_table]?.(event.ref_id) ?? "#"
  const isPayment = event.event_type === "rent_reception"
  const unallocated = isPayment && event.allocated === false

  return (
    <li className="relative py-3">
      {/* Nœud sur la ligne */}
      <span className="absolute -left-[23px] top-[18px] h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />

      <Link href={href} className="group flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <span className="font-medium">{event.label}</span>
            {unallocated ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Non alloué
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {[event.counterparty, event.unit_label].filter(Boolean).join(" · ") || "—"}
            {event.reference ? ` · Réf ${event.reference}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {event.amount != null ? (
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

      {/* Affordance d'allocation, uniquement sur les Fast-Log non alloués */}
      {unallocated ? (
        <div className="mt-1">
          <AllocateAffordance refId={event.ref_id} />
        </div>
      ) : null}
    </li>
  )
}
