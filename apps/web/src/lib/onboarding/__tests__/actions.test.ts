import { beforeEach, describe, expect, it, vi } from "vitest"

// createBail active des baux ET génère des échéances en un geste : c'est la plus
// grosse écriture d'argent du produit. Depuis la purge racine unique, les
// revalidatePath explicites sur /units et /tenants ont disparu (la racine les
// couvre). Ces tests verrouillent la nouvelle forme et l'absence de purge quand
// la RPC échoue.
const { RedirectSignal, revalidatePath, requireLandlordProfile, rpc, validateBailForm, eq, update, from } =
  vi.hoisted(() => {
    class RedirectSignal extends Error {
      constructor(readonly url: string) {
        super(`redirect:${url}`)
      }
    }
    return {
      RedirectSignal,
      revalidatePath: vi.fn(),
      requireLandlordProfile: vi.fn(),
      rpc: vi.fn(),
      validateBailForm: vi.fn(),
      eq: vi.fn(),
      update: vi.fn(),
      from: vi.fn(),
    }
  })

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url)
  },
}))

vi.mock("@/lib/landlords", () => ({
  requireLandlordProfile: () => requireLandlordProfile(),
}))

vi.mock("@/lib/idempotency", () => ({ readRequestId: () => "req-1" }))

vi.mock("../validation", () => ({
  validateBailForm: (...a: unknown[]) => validateBailForm(...a),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc, from }),
}))

import { createBail, setOnboardingStatus } from "../actions"

const PREV = { error: null, errorRow: null, values: null } as never

async function capture(fd: FormData): Promise<string> {
  try {
    await createBail(PREV, fd)
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url
    throw err
  }
  throw new Error("createBail n'a pas redirigé")
}

describe("createBail (contrat de purge argent)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireLandlordProfile.mockResolvedValue({ id: "ll-1" })
    validateBailForm.mockReturnValue({
      ok: true,
      property: { name: "Villa" },
      rows: [{ label: "A1" }],
    })
  })

  it("saisie invalide : RPC jamais appelée, aucune purge", async () => {
    validateBailForm.mockReturnValue({
      ok: false,
      formError: "Indiquez un lieu.",
      rowIndex: null,
    })
    const state = await createBail(PREV, new FormData())
    expect(state.error).toBe("Indiquez un lieu.")
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("RPC en échec : état d'erreur rendu, aucune purge", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } })
    const state = await createBail(PREV, new FormData())
    expect(state.error).toBeTruthy()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("succès : purge racine unique, /units et /tenants inclus par la racine", async () => {
    rpc.mockResolvedValue({
      data: { lease_ids: ["L1"], units: 2, leases: 1 },
      error: null,
    })
    const url = await capture(new FormData())
    expect(url).toBe("/leases?notice=bulk_created&units=2&leases=1")
    expect(revalidatePath.mock.calls).toEqual([["/", "layout"]])
  })
})

// Statut de prise en main : le contrat a changé le 2026-07-27. L'échec partait
// dans un console.error et l'appelant (OnboardingComplete) rafraîchissait quoi
// qu'il arrive — le rail « Premiers pas » revenait à chaque visite sans
// explication. L'action renvoie désormais son résultat.
describe("setOnboardingStatus (contrat de résultat)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireLandlordProfile.mockResolvedValue({ id: "landlord-1" })
    update.mockReturnValue({ eq })
    from.mockReturnValue({ update })
  })

  it("succès : renvoie ok et purge le tableau de bord", async () => {
    eq.mockResolvedValue({ error: null })
    await expect(setOnboardingStatus("done")).resolves.toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith({ onboarding_status: "done" })
    expect(eq).toHaveBeenCalledWith("id", "landlord-1")
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
  })

  it("erreur DB : renvoie l'échec, sans purger (rien n'a changé en base)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    eq.mockResolvedValue({ error: { code: "42501", message: "denied" } })
    await expect(setOnboardingStatus("done")).resolves.toEqual({
      ok: false,
      error: "Statut non enregistré.",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  // `pending` est un OnboardingStatus valide au TYPE mais absent de
  // SETTABLE_STATUS : seul le runtime le refuse. C'est le cas qui compte —
  // personne ne doit pouvoir remettre un bailleur en attente d'onboarding.
  it("statut non-settable : aucun toucher DB, pas même l'auth", async () => {
    await expect(setOnboardingStatus("pending")).resolves.toEqual({
      ok: false,
      error: "Statut invalide.",
    })
    expect(requireLandlordProfile).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})
