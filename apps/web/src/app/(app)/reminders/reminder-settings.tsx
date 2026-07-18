"use client"

import { useState, useTransition } from "react"
import type { ReminderChannel, ReminderMoment } from "@/lib/landlords"
import { setReminderSettings } from "@/lib/reminders/actions"
import { buildReminderMessage } from "@/lib/reminders/whatsapp"

// Réglages de relance du propriétaire (demande du 2026-07-18) : canal, moment
// et aperçu du message par défaut, directement sur /reminders. Jusqu'ici ces
// réglages n'avaient d'UI que dans /first-run, inaccessible une fois
// l'onboarding terminé. Persistance via setReminderSettings (jamais bloquant),
// état optimiste local : un échec DB est journalisé côté serveur, l'UI reste
// fluide. Ranti-ops lit ces préférences pour composer et cadencer les envois.

const MOMENTS: { id: ReminderMoment; label: string }[] = [
  { id: "avant", label: "3 jours avant l'échéance" },
  { id: "echeance", label: "Le jour de l'échéance" },
  { id: "retard", label: "En cas de retard" },
]

// Aperçu construit avec le VRAI gabarit d'envoi (buildReminderMessage) sur des
// valeurs d'exemple : le nom, le montant et la date réels sont insérés par
// bail au moment de l'envoi.
function previewMessage(moment: ReminderMoment): string {
  return buildReminderMessage({
    tenantName: null,
    amount: 100000,
    dueDate: "2026-08-05",
    late: moment === "retard",
    confirmUrl: null,
  })
}

export function ReminderSettings({
  initialEnabled,
  initialChannel,
  initialMoment,
}: {
  initialEnabled: boolean
  initialChannel: ReminderChannel | null
  initialMoment: ReminderMoment | null
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [channel, setChannel] = useState<ReminderChannel>(initialChannel ?? "whatsapp")
  const [moment, setMoment] = useState<ReminderMoment>(initialMoment ?? "echeance")
  const [, startTransition] = useTransition()

  function persist(next: { enabled?: boolean; channel?: ReminderChannel; moment?: ReminderMoment }) {
    const payload = {
      enabled: next.enabled ?? enabled,
      channel: next.channel ?? channel,
      moment: next.moment ?? moment,
    }
    startTransition(() => {
      void setReminderSettings(payload)
    })
  }

  const canalLabel = channel === "whatsapp" ? "WhatsApp" : "SMS"

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Relance automatique</h2>
          <p className="mt-0.5 text-sm leading-6 text-foreground/70">
            {enabled
              ? `Ranti relance vos locataires par ${canalLabel}, en votre nom.`
              : "Désactivée : vous relancez vous-même depuis la fiche du bail."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Relance automatique"
          onClick={() => {
            const next = !enabled
            setEnabled(next)
            persist({ enabled: next })
          }}
          className={`relative h-7 w-12 flex-shrink-0 rounded-full transition ${enabled ? "bg-accent" : "bg-border"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-all ${enabled ? "left-6" : "left-1"}`}
          />
        </button>
      </div>

      {enabled ? (
        <div className="space-y-5 border-t border-border px-4 py-4 sm:px-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Canal</p>
            <div className="flex gap-2">
              {(["whatsapp", "sms"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setChannel(c)
                    persist({ channel: c })
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    channel === c
                      ? "border-accent bg-secondary text-foreground"
                      : "border-border text-foreground/60 hover:bg-secondary/60"
                  }`}
                >
                  {c === "whatsapp" ? "WhatsApp" : "SMS"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Moment privilégié</p>
            <div className="space-y-2">
              {MOMENTS.map((m) => {
                const selected = moment === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMoment(m.id)
                      persist({ moment: m.id })
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? "border-accent bg-secondary text-foreground"
                        : "border-border text-foreground/70 hover:bg-secondary/60"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? "border-accent" : "border-border"
                      }`}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                    </span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-line-soft bg-muted px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Message par défaut ({canalLabel})
            </p>
            <p className="mt-1.5 text-sm leading-6 text-foreground">
              {previewMessage(moment)}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Le nom du locataire, le montant et la date réels sont insérés pour
              chaque bail. Message neutre, envoyé du registre.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
