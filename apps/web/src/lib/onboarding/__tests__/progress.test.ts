import { beforeEach, describe, expect, it, vi } from "vitest"

// La progression des « Premiers pas » est DÉRIVÉE des données réelles à chaque
// rendu — jamais stockée (cf. progress.ts). Ces tests verrouillent ce contrat :
// une étape est faite ssi la donnée correspondante existe, l'ordre est stable,
// et allDone ne s'allume qu'avec les quatre artefacts présents.

vi.mock("@/lib/leases", () => ({ getLandlordLeases: vi.fn() }))
vi.mock("@/lib/collections", () => ({ getLandlordCollections: vi.fn() }))
vi.mock("@/lib/receipts", () => ({ getLandlordReceipts: vi.fn() }))
vi.mock("@/lib/reminders/queries", () => ({ getLandlordReminders: vi.fn() }))

import { getLandlordLeases } from "@/lib/leases"
import { getLandlordCollections } from "@/lib/collections"
import { getLandlordReceipts } from "@/lib/receipts"
import { getLandlordReminders } from "@/lib/reminders/queries"
import { getOnboardingProgress } from "../progress"

const LID = "landlord-1"

function seed(counts: { leases?: number; collections?: number; receipts?: number; reminders?: number }) {
  vi.mocked(getLandlordLeases).mockResolvedValue(Array(counts.leases ?? 0).fill({}) as never)
  vi.mocked(getLandlordCollections).mockResolvedValue(Array(counts.collections ?? 0).fill({}) as never)
  vi.mocked(getLandlordReceipts).mockResolvedValue(Array(counts.receipts ?? 0).fill({}) as never)
  vi.mocked(getLandlordReminders).mockResolvedValue(Array(counts.reminders ?? 0).fill({}) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getOnboardingProgress", () => {
  it("espace vierge : 0/4, rien de fait, pas de allDone", async () => {
    seed({})
    const p = await getOnboardingProgress(LID)
    expect(p.total).toBe(4)
    expect(p.doneCount).toBe(0)
    expect(p.allDone).toBe(false)
    expect(p.steps.every((s) => !s.done)).toBe(true)
  })

  it("ordre stable des étapes : bail → paiement → quittance → relance", async () => {
    seed({})
    const p = await getOnboardingProgress(LID)
    expect(p.steps.map((s) => s.key)).toEqual(["lease", "payment", "receipt", "reminder"])
  })

  it("chaque étape est dérivée de SA donnée (bail seul ⇒ seul lease done)", async () => {
    seed({ leases: 1 })
    const p = await getOnboardingProgress(LID)
    expect(p.steps.find((s) => s.key === "lease")?.done).toBe(true)
    expect(p.doneCount).toBe(1)
    expect(p.allDone).toBe(false)
  })

  it("étape faite reste cochée même si une antérieure ne l'est pas", async () => {
    // Cas réel : relance programmée avant tout encaissement.
    seed({ leases: 1, reminders: 1 })
    const p = await getOnboardingProgress(LID)
    expect(p.steps.find((s) => s.key === "reminder")?.done).toBe(true)
    expect(p.steps.find((s) => s.key === "payment")?.done).toBe(false)
    expect(p.doneCount).toBe(2)
  })

  it("allDone ssi les quatre artefacts existent", async () => {
    seed({ leases: 2, collections: 1, receipts: 3, reminders: 1 })
    const p = await getOnboardingProgress(LID)
    expect(p.doneCount).toBe(4)
    expect(p.allDone).toBe(true)
  })

  it("chaque étape pointe vers un vrai écran (deep-link non vide)", async () => {
    seed({})
    const p = await getOnboardingProgress(LID)
    for (const s of p.steps) {
      expect(s.href).toMatch(/^\//)
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.desc.length).toBeGreaterThan(0)
    }
  })
})
