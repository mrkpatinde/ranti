import { beforeEach, describe, expect, it, vi } from "vitest"

// Le rail de la prise en main guidée est DÉRIVÉ du statut + de la progression
// réelle, jamais stocké (cf. guided.ts). Ces tests verrouillent le contrat :
// l'étape courante = première non faite, la position est 1-based, la prochaine
// cible pointe vers son deep-link, et le rail n'est « actif » qu'en statut
// « guided » tant qu'il reste une étape.

vi.mock("@/lib/leases", () => ({ getLandlordLeases: vi.fn() }))
vi.mock("@/lib/collections", () => ({ getLandlordCollections: vi.fn() }))
vi.mock("@/lib/receipts", () => ({ getLandlordReceipts: vi.fn() }))
vi.mock("@/lib/reminders/queries", () => ({ getLandlordReminders: vi.fn() }))

import { getLandlordLeases } from "@/lib/leases"
import { getLandlordCollections } from "@/lib/collections"
import { getLandlordReceipts } from "@/lib/receipts"
import { getLandlordReminders } from "@/lib/reminders/queries"
import type { OnboardingProgress, OnboardingStep } from "../progress"
import { buildGuidedRail, getGuidedRail } from "../guided"

const LID = "landlord-1"

function seed(counts: { leases?: number; collections?: number; receipts?: number; reminders?: number }) {
  vi.mocked(getLandlordLeases).mockResolvedValue(Array(counts.leases ?? 0).fill({}) as never)
  vi.mocked(getLandlordCollections).mockResolvedValue(Array(counts.collections ?? 0).fill({}) as never)
  vi.mocked(getLandlordReceipts).mockResolvedValue(Array(counts.receipts ?? 0).fill({}) as never)
  vi.mocked(getLandlordReminders).mockResolvedValue(Array(counts.reminders ?? 0).fill({}) as never)
}

// Progression fabriquée pour tester buildGuidedRail sans base : seul l'état
// « done » de chaque étape compte pour la dérivation du rail.
function progressOf(done: boolean[]): OnboardingProgress {
  const keys: OnboardingStep["key"][] = ["lease", "payment", "receipt", "reminder"]
  const steps: OnboardingStep[] = keys.map((key, i) => ({
    key,
    label: key,
    desc: key,
    href: `/${key}`,
    done: done[i] ?? false,
  }))
  const doneCount = steps.filter((s) => s.done).length
  return { steps, total: steps.length, doneCount, allDone: doneCount === steps.length }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getGuidedRail", () => {
  it("espace vierge, guidé : étape courante = bail, position 1/4, cible = /leases/new", async () => {
    seed({})
    const rail = await getGuidedRail(LID, "guided")
    expect(rail.active).toBe(true)
    expect(rail.current?.key).toBe("lease")
    expect(rail.position).toEqual({ index: 1, total: 4 })
    expect(rail.next).toEqual({ key: "lease", label: "Créer votre premier bail", href: "/leases/new" })
    expect(rail.isLastStep).toBe(false)
    expect(rail.steps.map((s) => s.state)).toEqual(["active", "locked", "locked", "locked"])
  })

  it("bail fait : l'étape courante avance au paiement (position 2/4)", async () => {
    seed({ leases: 1 })
    const rail = await getGuidedRail(LID, "guided")
    expect(rail.current?.key).toBe("payment")
    expect(rail.position).toEqual({ index: 2, total: 4 })
    expect(rail.steps.map((s) => s.state)).toEqual(["done", "active", "locked", "locked"])
  })

  it("étape faite hors ordre reste « done », l'active reste la première non faite", async () => {
    // Relance programmée avant tout encaissement : active = paiement, relance done.
    seed({ leases: 1, reminders: 1 })
    const rail = await getGuidedRail(LID, "guided")
    expect(rail.current?.key).toBe("payment")
    expect(rail.steps.map((s) => s.state)).toEqual(["done", "active", "locked", "done"])
  })

  it("dernière étape : relance active, isLastStep vrai", async () => {
    seed({ leases: 1, collections: 1, receipts: 1 })
    const rail = await getGuidedRail(LID, "guided")
    expect(rail.current?.key).toBe("reminder")
    expect(rail.position).toEqual({ index: 4, total: 4 })
    expect(rail.isLastStep).toBe(true)
  })

  it("tout fait : rail inactif, plus d'étape courante ni de cible", async () => {
    seed({ leases: 1, collections: 1, receipts: 1, reminders: 1 })
    const rail = await getGuidedRail(LID, "guided")
    expect(rail.allDone).toBe(true)
    expect(rail.active).toBe(false)
    expect(rail.current).toBeNull()
    expect(rail.position).toBeNull()
    expect(rail.next).toBeNull()
    expect(rail.isLastStep).toBe(false)
    expect(rail.steps.every((s) => s.state === "done")).toBe(true)
  })
})

describe("buildGuidedRail — drapeau active selon le statut", () => {
  it("« guided » + étape restante ⇒ actif", () => {
    expect(buildGuidedRail("guided", progressOf([true, false, false, false])).active).toBe(true)
  })

  it("« guided » mais tout fait ⇒ inactif", () => {
    expect(buildGuidedRail("guided", progressOf([true, true, true, true])).active).toBe(false)
  })

  it.each(["pending", "exploring", "done"] as const)(
    "statut « %s » (non guidé) ⇒ inactif même avec des étapes restantes",
    (status) => {
      const rail = buildGuidedRail(status, progressOf([false, false, false, false]))
      expect(rail.active).toBe(false)
      // La dérivation reste calculée (étape courante disponible) même inactif.
      expect(rail.current?.key).toBe("lease")
    },
  )
})
