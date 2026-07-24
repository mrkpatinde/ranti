import { beforeEach, describe, expect, it, vi } from "vitest"

// #167 Phase 4 — confirmer/annuler renvoient un état (plus de redirect) :
// c'est le contrat sur lequel repose le rollback optimiste de la carte.
const { revalidatePath, requireLandlordProfile, rpc } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireLandlordProfile: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))

vi.mock("@/lib/landlords", () => ({
  requireLandlordProfile: () => requireLandlordProfile(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc }),
}))

import { cancelCollection, confirmCollection } from "../actions"

function fd(entries: Record<string, string> = {}): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

const PREV = { error: null }
const ID = "cc000000-0000-0000-0000-000000000001"

describe("confirmCollection (#167 P4 — retour d'état)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireLandlordProfile.mockResolvedValue({ id: "ll-1" })
  })

  it("id manquant → erreur, RPC jamais appelée", async () => {
    const r = await confirmCollection(PREV, fd())
    expect(r).toEqual({ error: "Encaissement introuvable." })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("conflit d'allocation à la confirmation → message dédié, pas de revalidation", async () => {
    rpc.mockResolvedValue({ error: { message: "allocation_exceeds_due_at_confirm" } })
    const r = await confirmCollection(PREV, fd({ id: ID }))
    expect(r.error).toContain("une autre confirmation a déjà couvert")
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("succès → { error: null }, document généré dans la foulée, caches revalidés", async () => {
    rpc.mockResolvedValue({ data: "receipt-1", error: null })
    const r = await confirmCollection(PREV, fd({ id: ID }))
    expect(r).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("confirm_collection", { p_reception_id: ID })
    expect(rpc).toHaveBeenCalledWith("generate_receipt", { p_reception_id: ID })
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })
})

describe("cancelCollection (#167 P4 — retour d'état)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireLandlordProfile.mockResolvedValue({ id: "ll-1" })
  })

  it("motif manquant → erreur, RPC jamais appelée", async () => {
    const r = await cancelCollection(PREV, fd({ id: ID }))
    expect(r.error).toContain("Indiquez pourquoi")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("document actif (has_receipt) → message dédié", async () => {
    rpc.mockResolvedValue({ error: { message: "has_receipt" } })
    const r = await cancelCollection(PREV, fd({ id: ID, reason: "erreur de saisie" }))
    expect(r.error).toContain("quittance a déjà été générée")
  })

  it("succès → { error: null } + caches revalidés", async () => {
    rpc.mockResolvedValue({ error: null })
    const r = await cancelCollection(PREV, fd({ id: ID, reason: "erreur de saisie" }))
    expect(r).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("cancel_collection", { p_reception_id: ID, p_reason: "erreur de saisie" })
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })
})
