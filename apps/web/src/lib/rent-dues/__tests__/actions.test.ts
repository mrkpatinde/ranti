import { beforeEach, describe, expect, it, vi } from "vitest"

// Contrat de purge argent : générer des échéances ÉCRIT de l'argent, donc
// l'action doit purger la racine ("/", "layout") et rien d'autre. Le pendant
// compte autant : un échec ne purge JAMAIS, sinon on invaliderait tout le cache
// de navigation sur une non-écriture.
const { RedirectSignal, revalidatePath, requireLandlordProfile, rpc } = vi.hoisted(() => {
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc }),
}))

import { generateRentDues } from "../actions"

function form(entries: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

async function runAndCaptureRedirect(fd: FormData): Promise<string> {
  try {
    await generateRentDues(fd)
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url
    throw err
  }
  throw new Error("generateRentDues n'a pas redirigé")
}

const LEASE = "bb000000-0000-0000-0000-000000000001"

describe("generateRentDues (contrat de purge argent)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireLandlordProfile.mockResolvedValue({ id: "ll-1" })
  })

  it("lease_id manquant : RPC jamais appelée, aucune purge", async () => {
    const url = await runAndCaptureRedirect(form())
    expect(url).toBe(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("bail introuvable (P0002) : aucune purge", async () => {
    rpc.mockResolvedValue({ error: { code: "P0002", message: "not found" } })
    const url = await runAndCaptureRedirect(form({ lease_id: LEASE }))
    expect(url).toBe(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("erreur RPC inconnue : aucune purge", async () => {
    rpc.mockResolvedValue({ error: { code: "XX000", message: "boom" } })
    const url = await runAndCaptureRedirect(form({ lease_id: LEASE }))
    expect(url).toContain(`/leases/${LEASE}?error=`)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("succès : purge racine unique, puis notice", async () => {
    rpc.mockResolvedValue({ error: null })
    const url = await runAndCaptureRedirect(form({ lease_id: LEASE }))
    expect(rpc).toHaveBeenCalledWith("generate_rent_dues", { p_lease_id: LEASE })
    expect(url).toBe(`/leases/${LEASE}?notice=dues_generated`)
    expect(revalidatePath.mock.calls).toEqual([["/", "layout"]])
  })
})
