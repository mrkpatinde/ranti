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

import { QueryError } from "@/lib/supabase/query-error"
import { getLeaseReminders } from "../queries"

// Builder PostgREST minimal : select/eq/in/order rendent la chaîne, limit
// résout le résultat. eq/in ENREGISTRENT leurs arguments : le scoping
// (landlord_id, rent_due_id) fait partie du contrat — un filtre perdu ne
// serait rattrapé que par la RLS, silencieusement.
type FilterCalls = Record<string, { eq: unknown[][]; in: unknown[][] }>

function makeSupabase(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: FilterCalls = {}
  return {
    calls,
    from(table: string) {
      calls[table] ??= { eq: [], in: [] }
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => {
          calls[table].eq.push(args)
          return chain
        },
        in: (...args: unknown[]) => {
          calls[table].in.push(args)
          return chain
        },
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
    const sb = makeSupabase({
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
    createClient.mockResolvedValue(sb)

    const rows = await getLeaseReminders("ll-1", ["rd-1"])

    expect(rows).toHaveLength(2)
    // Tri décroissant sur sent_at : la relance ops (07-09) passe devant.
    expect(rows[0]).toMatchObject({ id: "m-1", channel: "whatsapp_manual", template: "j+3" })
    expect(rows[1]).toMatchObject({ id: "a-1", channel: "sms", template: "j-5" })
    // Scoping verrouillé sur les DEUX tables : bailleur + échéances du bail.
    // Un filtre perdu passerait tous les tests sinon (rattrapé que par la RLS).
    expect(sb.calls.reminders.eq).toContainEqual(["landlord_id", "ll-1"])
    expect(sb.calls.reminders.in).toContainEqual(["rent_due_id", ["rd-1"]])
    expect(sb.calls.reminder_events.eq).toContainEqual(["landlord_id", "ll-1"])
    expect(sb.calls.reminder_events.in).toContainEqual(["rent_due_id", ["rd-1"]])
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

    await expect(getLeaseReminders("ll-1", ["rd-1"])).rejects.toThrow(QueryError)
    await expect(getLeaseReminders("ll-1", ["rd-1"])).rejects.toThrow("[reminders]")
  })

  it("jette QueryError quand la lecture des relances ops échoue", async () => {
    createClient.mockResolvedValue(
      makeSupabase({
        reminders: { data: [], error: null },
        reminder_events: { data: null, error: { message: "boom", code: "XX000" } },
      })
    )

    await expect(getLeaseReminders("ll-1", ["rd-1"])).rejects.toThrow(QueryError)
    await expect(getLeaseReminders("ll-1", ["rd-1"])).rejects.toThrow("[reminder_events]")
  })
})
