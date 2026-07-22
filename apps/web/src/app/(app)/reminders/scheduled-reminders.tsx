"use client"

// Relances programmées, annulation optimiste : la ligne disparaît au clic
// (le geste répond tout de suite, réseau terrain compris), l'action serveur
// suit dans une transition. Échec RPC : useOptimistic restaure la ligne de
// lui-même à la fin de la transition, l'erreur s'affiche sous la liste et la
// revalidation (faite aussi sur échec) remplace toute ligne fantôme par
// l'état réel. Les boutons sont inertes pendant la transition : un double
// tap ne part jamais en double RPC. L'erreur affichée est celle du dernier
// geste ; elle s'efface quand une NOUVELLE relance apparaît (programmation),
// pas quand une ligne se retire, sinon elle serait mangée par la
// revalidation du geste qui vient d'échouer.
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react"
import { Alert } from "@/components/ui/alert"
import { cancelScheduledReminder } from "@/lib/reminders/actions"

export type ScheduledReminderRow = {
  id: string
  who: string
  what: string
  channelLabel: string
  dateLabel: string
}

export function ScheduledReminders({ rows }: { rows: ScheduledReminderRow[] }) {
  const [hiddenIds, hide] = useOptimistic<string[], string>([], (prev, id) => [...prev, id])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const rowIds = rows.map((r) => r.id).join("|")
  const prevIdsRef = useRef(rowIds)
  useEffect(() => {
    const prev = new Set(prevIdsRef.current.split("|"))
    prevIdsRef.current = rowIds
    if (rows.some((r) => !prev.has(r.id))) setError(null)
  }, [rowIds, rows])

  const visible = rows.filter((r) => !hiddenIds.includes(r.id))
  if (visible.length === 0 && !error) return null

  function cancel(id: string) {
    setError(null)
    startTransition(async () => {
      hide(id)
      const formData = new FormData()
      formData.set("id", id)
      try {
        const result = await cancelScheduledReminder(formData)
        if (result.error) setError(result.error)
      } catch {
        // Réseau coupé ou erreur serveur inattendue : sans ce filet, le rejet
        // remonterait à l'error boundary racine et remplacerait toute la page.
        // L'optimiste se restaure seul en fin de transition ; même repli que
        // l'action.
        setError("Annulation impossible. Réessayez.")
      }
    })
  }

  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Relances programmées par vous</h2>
      {visible.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {visible.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0 sm:px-5"
            >
              <span aria-hidden className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-foreground">{s.who}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.what} · {s.channelLabel} · le {s.dateLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => cancel(s.id)}
                disabled={isPending}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </section>
  )
}
