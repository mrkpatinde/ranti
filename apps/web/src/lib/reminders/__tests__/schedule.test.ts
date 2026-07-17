import { describe, expect, it } from "vitest"
import { computeUpcomingReminders, detectReminderSilence } from "../schedule"
import type { RentDueBalance } from "@/lib/rent-dues/types"

const REF = new Date(2026, 6, 15) // 2026-07-15 (mois local)

// Par défaut : le bail porte un impayé au grand livre (fenêtres de retard actives).
const CHASE = new Map([["lease", 50000]])
// Bail à jour au compte courant (avance affectée à un mois futur, etc.).
const EVEN = new Map([["lease", 0]])

function due(overrides: Partial<RentDueBalance>): RentDueBalance {
  return {
    id: "d",
    landlord_id: "l",
    lease_id: "lease",
    unit_id: "unit",
    tenant_id: "tenant",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    due_date: "2026-07-25",
    amount_due: 50000,
    amount_paid: 0,
    currency: "XOF",
    status: "expected",
    cancelled_reason: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...overrides,
  } as RentDueBalance
}

describe("computeUpcomingReminders", () => {
  it("échéance à venir → prochaine fenêtre J-5 à due-5", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-25" })], CHASE, REF)
    expect(r).toEqual([
      expect.objectContaining({ label: "Rappel J-5", date: "2026-07-20", late: false }),
    ])
  })

  it("échéance demain → prochaine = la veille (aujourd'hui)", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-16" })], CHASE, REF)
    expect(r[0]).toMatchObject({ label: "Rappel la veille", date: "2026-07-15", late: false })
  })

  it("échéance passée non soldée → prochaine fenêtre de retard (J+10)", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-10" })], CHASE, REF)
    expect(r[0]).toMatchObject({ label: "Relance J+10", date: "2026-07-20", late: true })
  })

  it("cadence épuisée (au-delà de J+10) → exclue", () => {
    expect(computeUpcomingReminders([due({ due_date: "2026-07-01" })], CHASE, REF)).toEqual([])
  })

  it("échéance soldée ou annulée → exclue", () => {
    expect(
      computeUpcomingReminders(
        [
          due({ id: "paid", due_date: "2026-07-25", amount_paid: 50000 }),
          due({ id: "cancelled", due_date: "2026-07-25", status: "cancelled" }),
        ],
        CHASE,
        REF,
      ),
    ).toEqual([])
  })

  it("garde compte courant : bail à jour au grand livre → aucune fenêtre de RETARD projetée", () => {
    // Échéance passée non soldée par échéance, mais l'avance nette la dette
    // au compte courant (ADR-023) : la relance J+10 ne doit pas être promise.
    expect(computeUpcomingReminders([due({ due_date: "2026-07-10" })], EVEN, REF)).toEqual([])
  })

  it("garde compte courant : les rappels PRÉ-échéance restent projetés pour un bail à jour", () => {
    const r = computeUpcomingReminders([due({ due_date: "2026-07-25" })], EVEN, REF)
    expect(r[0]).toMatchObject({ label: "Rappel J-5", date: "2026-07-20", late: false })
  })

  it("bail absent de la map → traité comme à jour (pas de relance de retard fantôme)", () => {
    expect(
      computeUpcomingReminders([due({ due_date: "2026-07-10" })], new Map(), REF),
    ).toEqual([])
  })

  it("tri par date croissante (la plus proche d'abord)", () => {
    const r = computeUpcomingReminders(
      [
        due({ id: "far", due_date: "2026-08-10" }), // J-5 le 08-05
        due({ id: "soon", due_date: "2026-07-16" }), // veille le 07-15
      ],
      CHASE,
      REF,
    )
    expect(r.map((x) => x.dueId)).toEqual(["soon", "far"])
  })
})

// ── Garde-fou ADR-022 : silence d'envoi ─────────────────────────────────────

describe("detectReminderSilence", () => {
  // REF = 2026-07-15 ; grâce 2 jours → fenêtres « dues » si <= 2026-07-13.

  it("fenêtre passée depuis plus de 2 jours, aucun envoi → silence signalé", () => {
    // due_date 2026-07-16 → J-5 = 2026-07-11 (<= cutoff 13), J-1 = 15 (> cutoff)
    const r = detectReminderSilence([due({ id: "a", due_date: "2026-07-16" })], [], CHASE, REF)
    expect(r).toEqual({ silentDues: 1, oldestMissedWindow: "2026-07-11" })
  })

  it("envoi tracé depuis la fenêtre → rien à signaler", () => {
    const r = detectReminderSilence(
      [due({ id: "a", due_date: "2026-07-16" })],
      [{ dueId: "a", sentAt: "2026-07-11T09:00:00Z" }],
      CHASE,
      REF,
    )
    expect(r).toBeNull()
  })

  it("un envoi pour une AUTRE échéance ne couvre pas celle-ci", () => {
    const r = detectReminderSilence(
      [due({ id: "a", due_date: "2026-07-16" })],
      [{ dueId: "b", sentAt: "2026-07-11T09:00:00Z" }],
      CHASE,
      REF,
    )
    expect(r?.silentDues).toBe(1)
  })

  it("fenêtre passée mais encore dans le délai de grâce → silence normal", () => {
    // due_date 2026-07-19 → J-5 = 2026-07-14 (> cutoff 13) : ops a encore le temps.
    expect(detectReminderSilence([due({ id: "a", due_date: "2026-07-19" })], [], CHASE, REF)).toBeNull()
  })

  it("échéance soldée ou annulée → ignorée", () => {
    const r = detectReminderSilence(
      [
        due({ id: "paid", due_date: "2026-07-16", amount_paid: 50000 }),
        due({ id: "cancelled", due_date: "2026-07-16", status: "cancelled" }),
      ],
      [],
      CHASE,
      REF,
    )
    expect(r).toBeNull()
  })

  it("un envoi ANTÉRIEUR à la dernière fenêtre due ne suffit pas", () => {
    // due_date 2026-07-05 → fenêtres jusqu'à J+3 = 2026-07-08 <= cutoff ;
    // envoi du 2026-07-01 (avant J+3) → la fenêtre J+3 est bien manquée.
    const r = detectReminderSilence(
      [due({ id: "a", due_date: "2026-07-05", status: "overdue" })],
      [{ dueId: "a", sentAt: "2026-07-01T09:00:00Z" }],
      CHASE,
      REF,
    )
    expect(r).toEqual({ silentDues: 1, oldestMissedWindow: "2026-07-08" })
  })

  it("garde compte courant : une fenêtre de RETARD manquée sur un bail à jour n'est pas une panne", () => {
    // due_date 2026-07-05, bail à jour au grand livre : J+3/J+10 ne sont pas
    // attendues (la file ne les contient pas) — mais J-5/J-1/J0 (pré-échéance)
    // restent dues : ici elles sont toutes passées SANS envoi → silence réel,
    // ancré sur la dernière fenêtre pré-échéance (le jour J, 07-05).
    const r = detectReminderSilence(
      [due({ id: "a", due_date: "2026-07-05", status: "overdue" })],
      [],
      EVEN,
      REF,
    )
    expect(r).toEqual({ silentDues: 1, oldestMissedWindow: "2026-07-05" })
  })

  it("garde compte courant : envoi pré-échéance tracé + bail à jour → aucun silence", () => {
    const r = detectReminderSilence(
      [due({ id: "a", due_date: "2026-07-05", status: "overdue" })],
      [{ dueId: "a", sentAt: "2026-07-05T09:00:00Z" }],
      EVEN,
      REF,
    )
    expect(r).toBeNull()
  })

  it("plusieurs échéances silencieuses → compte + plus ancienne fenêtre", () => {
    const r = detectReminderSilence(
      [
        due({ id: "a", due_date: "2026-07-16" }), // J-5 = 07-11
        due({ id: "b", due_date: "2026-07-05", status: "overdue" }), // J+3 = 07-08
      ],
      [],
      CHASE,
      REF,
    )
    expect(r).toEqual({ silentDues: 2, oldestMissedWindow: "2026-07-08" })
  })
})
