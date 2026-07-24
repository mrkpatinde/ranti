import { beforeEach, describe, expect, it, vi } from "vitest"

// Contrat de purge argent pour les trois écritures du cycle de vie d'un bail.
// Depuis la purge racine unique, plus aucun revalidatePath par chemin : une
// seule entrée ("/", "layout") couvre dashboard, encaissements, quittances,
// relances, journal, liste ET fiches bail, plus /properties. Ces tests
// verrouillent ça, et surtout qu'un échec ne purge rien.
const {
  RedirectSignal,
  revalidatePath,
  requireLandlordProfile,
  getLease,
  getUnit,
  getTenant,
  from,
  rpc,
} = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(readonly url: string) {
      super(`redirect:${url}`)
    }
  }
  return {
    RedirectSignal,
    revalidatePath: vi.fn(),
    requireLandlordProfile: vi.fn(),
    getLease: vi.fn(),
    getUnit: vi.fn(),
    getTenant: vi.fn(),
    from: vi.fn(),
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

vi.mock("@/lib/units", () => ({ getUnit: (...a: unknown[]) => getUnit(...a) }))
vi.mock("@/lib/tenants", () => ({ getTenant: (...a: unknown[]) => getTenant(...a) }))
vi.mock("../queries", () => ({ getLease: (...a: unknown[]) => getLease(...a) }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from, rpc }),
}))

import { activateLease, createLease, endLease } from "../actions"

// Chaîne Supabase minimale : couvre insert().select().single() et
// update().eq().eq().eq() en restant awaitable au dernier maillon.
function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  c.insert = () => c
  c.update = () => c
  c.select = () => c
  c.eq = () => c
  c.single = () => Promise.resolve(result)
  c.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onOk, onErr)
  return c
}

function form(entries: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

async function capture(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url
    throw err
  }
  throw new Error("l'action n'a pas redirigé")
}

const ID = "bb000000-0000-0000-0000-000000000001"

const validLease = {
  unit_id: "u-1",
  tenant_id: "t-1",
  monthly_rent_amount: "100000",
  due_day: "5",
  start_date: "2026-01-01",
  currency: "XOF",
}

beforeEach(() => {
  vi.clearAllMocks()
  requireLandlordProfile.mockResolvedValue({ id: "ll-1" })
})

describe("createLease", () => {
  it("logement introuvable : aucune écriture, aucune purge", async () => {
    getUnit.mockResolvedValue(null)
    getTenant.mockResolvedValue({ id: "t-1" })
    const url = await capture(() => createLease(form(validLease)))
    expect(url).toContain("/leases/new?error=")
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("insert en échec : aucune purge", async () => {
    getUnit.mockResolvedValue({ id: "u-1" })
    getTenant.mockResolvedValue({ id: "t-1" })
    from.mockReturnValue(chain({ data: null, error: { code: "23505", message: "dup" } }))
    const url = await capture(() => createLease(form(validLease)))
    expect(url).toContain("/leases/new?error=")
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("succès : purge racine unique (couvre aussi /properties)", async () => {
    getUnit.mockResolvedValue({ id: "u-1" })
    getTenant.mockResolvedValue({ id: "t-1" })
    from.mockReturnValue(chain({ data: { id: ID }, error: null }))
    const url = await capture(() => createLease(form(validLease)))
    expect(url).toBe(`/leases/${ID}?notice=lease_created`)
    expect(revalidatePath.mock.calls).toEqual([["/", "layout"]])
  })
})

describe("activateLease", () => {
  it("bail hors brouillon : RPC jamais appelée, aucune purge", async () => {
    getLease.mockResolvedValue({ id: ID, status: "active" })
    const url = await capture(() => activateLease(form({ id: ID })))
    expect(url).toContain(`/leases/${ID}?error=`)
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("chevauchement (23P01) : aucune purge", async () => {
    getLease.mockResolvedValue({ id: ID, status: "draft" })
    rpc.mockResolvedValue({ error: { code: "23P01", message: "overlap" } })
    const url = await capture(() => activateLease(form({ id: ID })))
    expect(url).toContain(`/leases/${ID}?error=`)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("succès : purge racine unique (les échéances générées sont de l'argent)", async () => {
    getLease.mockResolvedValue({ id: ID, status: "draft" })
    rpc.mockResolvedValue({ error: null })
    const url = await capture(() => activateLease(form({ id: ID })))
    expect(rpc).toHaveBeenCalledWith("activate_lease", { p_lease_id: ID })
    expect(url).toBe(`/leases/${ID}?notice=lease_activated`)
    expect(revalidatePath.mock.calls).toEqual([["/", "layout"]])
  })
})

describe("endLease", () => {
  it("bail non actif : aucune écriture, aucune purge", async () => {
    getLease.mockResolvedValue({ id: ID, status: "draft", start_date: "2026-01-01" })
    const url = await capture(() => endLease(form({ id: ID })))
    expect(url).toContain(`/leases/${ID}?error=`)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("update en échec : aucune purge", async () => {
    getLease.mockResolvedValue({
      id: ID,
      status: "active",
      start_date: "2020-01-01",
      end_date: null,
    })
    from.mockReturnValue(chain({ error: { code: "XX000", message: "boom" } }))
    const url = await capture(() => endLease(form({ id: ID })))
    expect(url).toContain(`/leases/${ID}?error=`)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("succès : purge racine unique", async () => {
    getLease.mockResolvedValue({
      id: ID,
      status: "active",
      start_date: "2020-01-01",
      end_date: null,
    })
    from.mockReturnValue(chain({ error: null }))
    const url = await capture(() => endLease(form({ id: ID })))
    expect(url).toBe(`/leases/${ID}?notice=lease_ended`)
    expect(revalidatePath.mock.calls).toEqual([["/", "layout"]])
  })
})
