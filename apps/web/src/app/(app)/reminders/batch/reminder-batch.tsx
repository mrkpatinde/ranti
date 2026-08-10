"use client"

// File de relance : on coche, on ajuste le modèle, puis on ouvre les messages
// un par un. Ranti n'envoie rien — chaque lien ouvre WhatsApp avec le message
// pré-rempli, le gestionnaire relit et envoie. La trace n'est écrite qu'à la
// fin, en un appel, et seulement pour les lignes réellement ouvertes : quitter
// la file au milieu ne doit jamais enregistrer une relance qui n'a pas eu lieu.

import { useState, useTransition } from "react"
import { Alert } from "@/components/ui/alert"
import { buttonClasses } from "@/components/ui/button"
import { formatFcfa } from "@/lib/format"
import { logReminderBatch } from "@/lib/reminders/actions"
import { buildWaLink } from "@/lib/reminders/whatsapp"
import {
  DEFAULT_BATCH_TEMPLATE,
  TEMPLATE_PLACEHOLDERS,
  buildBatchMessages,
  groupReminderRows,
  isFullySelected,
  orderedSelection,
  renderRowMessage,
  toggleAll,
  toggleSelection,
  type ReminderBatchRow,
  type ReminderGroupBy,
} from "@/lib/reminders/batch"

function delayLabel(days: number): string {
  if (days > 1) return `${days} jours de retard`
  if (days === 1) return "1 jour de retard"
  if (days === 0) return "échéance aujourd'hui"
  if (days === -1) return "échéance demain"
  return `échéance dans ${-days} jours`
}

function shortDate(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  return at.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function ReminderBatch({ rows }: { rows: ReminderBatchRow[] }) {
  const allIds = rows.map((r) => r.rent_due_id)
  const [groupBy, setGroupBy] = useState<ReminderGroupBy>("owner")
  const [selected, setSelected] = useState<string[]>(allIds)
  const [template, setTemplate] = useState(DEFAULT_BATCH_TEMPLATE)

  // File gelée au démarrage : changer le modèle ou la sélection en cours
  // d'envoi ferait diverger le message tracé de celui qui est parti.
  const [queue, setQueue] = useState<ReminderBatchRow[] | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [opened, setOpened] = useState<string[]>([])

  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const groups = groupReminderRows(rows, groupBy)
  const selectedCount = orderedSelection(rows, selected).length

  function start() {
    const picked = orderedSelection(rows, selected)
    if (picked.length === 0) return
    setResult(null)
    setError(null)
    setQueue(picked)
    setMessages(buildBatchMessages(picked, template))
    setIndex(0)
    setOpened([])
  }

  function markOpened(id: string) {
    setOpened((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setIndex((prev) => prev + 1)
  }

  function finish() {
    const traced = opened
    // On ne transmet que les messages des lignes réellement ouvertes : la
    // trace enregistrée est exactement ce qui est parti, jamais la file
    // qu'on avait prévu de traiter.
    const sent = Object.fromEntries(traced.map((id) => [id, messages[id] ?? ""]))
    setQueue(null)
    if (traced.length === 0) return

    startTransition(async () => {
      try {
        const outcome = await logReminderBatch({ rentDueIds: traced, messages: sent })
        if (outcome.error) setError(outcome.error)
        else {
          setResult(outcome.logged)
          setSelected((prev) => prev.filter((id) => !traced.includes(id)))
        }
      } catch {
        setError("Enregistrement impossible. Réessayez.")
      }
    })
  }

  if (queue) {
    return (
      <SendPanel
        queue={queue}
        messages={messages}
        index={index}
        openedCount={opened.length}
        onOpen={markOpened}
        onSkip={() => setIndex((prev) => prev + 1)}
        onFinish={finish}
      />
    )
  }

  return (
    <>
      {isPending ? (
        <Alert variant="info" className="mt-6">
          Enregistrement des relances…
        </Alert>
      ) : result !== null ? (
        <Alert variant="success" className="mt-6">
          {result === 1 ? "1 relance enregistrée." : `${result} relances enregistrées.`}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Grouper par</span>
          <div className="inline-flex overflow-hidden rounded-full border border-border">
            <GroupTab
              active={groupBy === "owner"}
              label="Mandant"
              onClick={() => setGroupBy("owner")}
            />
            <GroupTab
              active={groupBy === "property"}
              label="Bien"
              onClick={() => setGroupBy("property")}
            />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isFullySelected(selected, allIds)}
            onChange={() => setSelected((prev) => toggleAll(prev, allIds))}
            className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-border accent-[hsl(var(--accent))]"
          />
          <span className="text-sm font-medium text-foreground">
            Tout sélectionner ({rows.length})
          </span>
        </label>

        <div className="mt-4 border-t border-border pt-4">
          <label
            htmlFor="modele"
            className="block text-sm font-medium text-foreground"
          >
            Modèle du message
          </label>
          <textarea
            id="modele"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Champs remplacés par ligne : {TEMPLATE_PLACEHOLDERS.map((p) => `{${p}}`).join(" · ")}
          </p>
        </div>

        <button
          type="button"
          onClick={start}
          disabled={selectedCount === 0 || isPending}
          className={buttonClasses("primary", "mt-4 w-full sm:w-auto")}
        >
          {selectedCount > 0
            ? `Commencer (${selectedCount})`
            : "Commencer"}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const ids = group.rows.map((r) => r.rent_due_id)
          return (
            <section key={group.key} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {group.label}
                </p>
                <button
                  type="button"
                  onClick={() => setSelected((prev) => toggleAll(prev, ids))}
                  className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  {isFullySelected(selected, ids) ? "Aucune" : `Les ${ids.length}`}
                </button>
              </div>

              {group.rows.map((row) => (
                <label
                  key={row.rent_due_id}
                  className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(row.rent_due_id)}
                    onChange={() =>
                      setSelected((prev) => toggleSelection(prev, row.rent_due_id))
                    }
                    className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-border accent-[hsl(var(--accent))]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-base font-medium text-foreground">
                        {row.tenant_name ?? "Locataire"}
                      </p>
                      <span className="flex-shrink-0 text-sm font-medium tabular-nums text-foreground">
                        {formatFcfa(row.amount_remaining)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {[row.property_name, row.unit_name].filter(Boolean).join(" · ") || "Lot"} ·{" "}
                      <span className={row.days_from_due > 0 ? "text-warning" : undefined}>
                        {delayLabel(row.days_from_due)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.last_reminder_at
                        ? `Dernière relance le ${shortDate(row.last_reminder_at)}`
                        : "Jamais relancé"}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {renderRowMessage(row, template)}
                    </p>
                  </div>
                </label>
              ))}
            </section>
          )
        })}
      </div>
    </>
  )
}

function GroupTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-2 text-sm font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  )
}

function SendPanel({
  queue,
  messages,
  index,
  openedCount,
  onOpen,
  onSkip,
  onFinish,
}: {
  queue: ReminderBatchRow[]
  messages: Record<string, string>
  index: number
  openedCount: number
  onOpen: (id: string) => void
  onSkip: () => void
  onFinish: () => void
}) {
  const row = queue[index]
  const done = !row
  const message = row ? (messages[row.rent_due_id] ?? "") : ""
  const wa = row ? buildWaLink(row.tenant_phone, message) : null
  const progress = Math.round((index / queue.length) * 100)

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card px-4 py-5 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {done ? "Fin de la file" : `${index + 1} sur ${queue.length}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {openedCount} {openedCount > 1 ? "ouvertes" : "ouverte"}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-accent transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {row ? (
        <>
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-base font-medium text-foreground">
                {row.tenant_name ?? "Locataire"}
              </p>
              <span className="flex-shrink-0 text-base font-semibold tabular-nums text-foreground">
                {formatFcfa(row.amount_remaining)}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {[row.property_name, row.unit_name].filter(Boolean).join(" · ") || "Lot"} ·{" "}
              {delayLabel(row.days_from_due)}
            </p>
          </div>

          <p className="mt-3 rounded-xl bg-secondary px-3 py-2.5 text-sm leading-6 text-foreground">
            {message}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpen(row.rent_due_id)}
                className={buttonClasses("primary")}
              >
                Ouvrir WhatsApp
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">
                Numéro inexploitable pour ce locataire.
              </span>
            )}
            <button type="button" onClick={onSkip} className={buttonClasses("secondary")}>
              Passer
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            WhatsApp s&apos;ouvre dans un autre onglet. Revenez ici pour la ligne suivante.
          </p>
        </>
      ) : (
        <p className="mt-5 text-sm leading-6 text-foreground/70">
          {openedCount === 0
            ? "Aucun message ouvert. Rien ne sera enregistré."
            : "Enregistrez les relances ouvertes pour en garder la trace."}
        </p>
      )}

      <button
        type="button"
        onClick={onFinish}
        className={buttonClasses(done ? "primary" : "secondary", "mt-4 w-full sm:w-auto")}
      >
        {openedCount > 0 ? `Terminer et enregistrer (${openedCount})` : "Quitter la file"}
      </button>
    </section>
  )
}
