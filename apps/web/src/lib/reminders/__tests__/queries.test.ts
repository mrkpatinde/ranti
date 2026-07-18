import { beforeEach, describe, expect, it, vi } from "vitest"

// Fil des relances d'un bail (fiche bail) : depuis le streaming Suspense, cette
// requête se chaîne sur les échéances DANS le Promise.all de la page — le
// contrat (garde tableau vide, fusion auto+ops, erreur → QueryError) doit être
// verrouillé par des tests, plus seulement exercé à travers la page.
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}))

import { getLeaseReminders } from "../queries"

// Builder PostgREST minimal : select/eq/in/order rendent la chaîne, limit
// résout le résultat — assez pour le chemin de getLeaseReminders.
function makeSupabase(results: Record<string, { data: unknown; error: unknown }>) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(results[table]),
      }
      return chain
    },
  }
}

const RENT_DUE = {
  id: "rd-1",
  tenant_id: "t-1",
  due_date: "2026-07-05",
  period_start: "2026-07-01",
  period_end: "2026-07-31",
  amount_due: 50000,
  status: "overdue",
  tenant: { first_name: "Awa", last_name: "K" },
  unit: { name: "Studio A" },
}

beforeEach(() => {
  createClient.mockReset()
})

describe("getLeaseReminders", () => {
  it("renvoie [] sans requête quand le bail n'a pas d'échéance", async () => {
    await expect(getLeaseReminders("ll-1", [])).resolves.toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it("fusionne SMS auto et relances ops (canal normalisé, fenêtre lisible), récent d'abord", async () => {
    createClient.mockResolvedValue(
      makeSupabase({
        reminders: {
          data: [
            { id: "a-1", channel: "sms", template: "j-5", sent_at: "2026-07-01T08:00:00Z", status: "sent", rent_due: RENT_DUE },
          ],
          error: null,
        },
        reminder_events: {
          data: [
            { id: "m-1", reminder_type: "late_j_3", sent_at: "2026-07-09T08:00:00Z", status: "sent", rent_due: RENT_DUE },
          ],
          error: null,
        },
      })
    )

    const rows = await getLeaseReminders("ll-1", ["rd-1"])

    expect(rows).toHaveLength(2)
    // Tri décroissant sur sent_at : la relance ops (07-09) passe devant.
    expect(rows[0]).toMatchObject({ id: "m-1", channel: "whatsapp_manual", template: "j+3" })
    expect(rows[1]).toMatchObject({ id: "a-1", channel: "sms", template: "j-5" })
  })

  it("garde le type ops inconnu tel quel comme fenêtre", async () => {
    createClient.mockResolvedValue(
      makeSupabase({
        reminders: { data: [], error: null },
        reminder_events: {
          data: [
            { id: "m-2", reminder_type: "custom_x", sent_at: "2026-07-02T08:00:00Z", status: "delivered", rent_due: null },
          ],
          error: null,
        },
      })
    )

    const rows = await getLeaseReminders("ll-1", ["rd-1"])
    expect(rows).toEqual([
      expect.objectContaining({ id: "m-2", channel: "whatsapp_manual", template: "custom_x" }),
    ])
  })

  it("jette QueryError quand la lecture des relances échoue", async () => {
    createClient.mockResolvedValue(
      makeSupabase({
        reminders: { data: null, error: { message: "boom", code: "XX000" } },
        reminder_events: { data: [], error: null },
      })
    )

    await expect(getLeaseReminders("ll-1", ["rd-1"])).rejects.toThrow()
  })

  it("jette QueryError quand la lecture des relances ops échoue", async () => {
    createClient.mockResolvedValue(
      makeSupabase({
        reminders: { data: [], error: null },
        reminder_events: { data: null, error: { message: "boom", code: "XX000" } },
      })
    )

    await expect(getLeaseReminders("ll-1", ["rd-1"])).rejects.toThrow()
  })
})
