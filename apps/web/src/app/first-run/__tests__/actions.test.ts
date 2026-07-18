import { beforeEach, describe, expect, it, vi } from "vitest"

// Orchestration des actions serveur FirstRun (phase 3) : createBailFirstRun
// (bulk_onboard_portfolio + lecture de la 1re echeance) et recordPaymentFirstRun
// (record_collection -> confirm_collection -> generate_receipt -> lecture de la
// quittance). Meme patron de mocks que lib/collections/__tests__/actions.test.ts.
const { revalidatePath, requireLandlordProfile, rpc, fromMock } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireLandlordProfile: vi.fn(),
  rpc: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))
vi.mock("@/lib/landlords", () => ({
  requireLandlordProfile: () => requireLandlordProfile(),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc, from: fromMock }),
}))

import { createBailFirstRun, recordPaymentFirstRun } from "../actions"

// Chaine de requete (select/eq/is/order/limit) terminee par maybeSingle.
function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ["select", "eq", "is", "order", "limit"]) c[m] = vi.fn(() => c)
  c.maybeSingle = vi.fn().mockResolvedValue(result)
  return c
}

const BAIL_INPUT = {
  propertyName: "Résidence Les Cocotiers",
  propertyCity: "Cotonou",
  unitName: "Chambre 1",
  unitType: "room",
  firstName: "Awa",
  lastName: "Simon",
  phone: "+229 01 23 45 67 89",
  email: "",
  monthlyRentAmount: "100000",
  dueDay: "5",
  startDate: "2026-07-01",
  requestId: "cc000000-0000-4000-8000-000000000001",
}

const PAY_INPUT = {
  tenantId: "t1",
  unitId: "u1",
  dueId: "d1",
  dueAmount: 100000,
  amount: "100 000",
  method: "cash",
  receivedAt: "2026-07-18",
  requestId: "cc000000-0000-4000-8000-000000000002",
}

const RECEIPT_ROW = {
  id: "r1",
  receipt_number: "RNT-2026-0001",
  kind: "quittance",
  total_amount: 100000,
  currency: "XOF",
  issued_at: "2026-07-18T08:00:00Z",
  snapshot: {
    tenant: { first_name: "Awa", last_name: "Simon", phone: null },
    unit: { name: "Chambre 1", type: "room" },
    allocations: [{ period_start: "2026-07-01", period_end: "2026-07-31", amount_allocated: 100000 }],
  },
  tenant_token: "7d14099a-3037-4d0d-b8fd-00d53d905397",
  sha256_fingerprint: null,
  tenant_ack: "unilateral",
}

beforeEach(() => {
  vi.clearAllMocks()
  requireLandlordProfile.mockResolvedValue({ id: "landlord-1" })
})

describe("createBailFirstRun", () => {
  it("chemin nominal : RPC + 1re echeance -> refs et libelles reels", async () => {
    rpc.mockResolvedValueOnce({ data: { lease_ids: ["l1"], units: 1, leases: 1 }, error: null })
    fromMock.mockReturnValueOnce(chain({ data: { id: "d1", unit_id: "u1", tenant_id: "t1", amount_due: 100000 }, error: null }))

    const res = await createBailFirstRun(BAIL_INPUT)
    expect(res).toMatchObject({ ok: true, leaseId: "l1", unitId: "u1", tenantId: "t1", dueId: "d1", dueAmount: 100000 })
    if (res.ok) {
      expect(res.tenantName).toBe("Awa Simon")
      expect(res.unitLabel).toContain("Chambre 1")
      expect(res.amountLabel).toBe("100 000 FCFA") // formatFcfa, U+00A0
    }
    expect(rpc).toHaveBeenCalledWith("bulk_onboard_portfolio", expect.objectContaining({
      p_request_id: BAIL_INPUT.requestId,
    }))
  })

  it("validation en amont : telephone manquant -> erreur, AUCUN appel RPC", async () => {
    const res = await createBailFirstRun({ ...BAIL_INPUT, phone: "" })
    expect(res.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("erreur RPC 23505 -> message metier, jamais le message brut", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } })
    const res = await createBailFirstRun(BAIL_INPUT)
    expect(res).toEqual({ ok: false, error: "Un logement porte deja ce nom dans ce lieu." })
  })

  it("echeance introuvable : le bail reste cree, dueId null, montant depuis la saisie", async () => {
    rpc.mockResolvedValueOnce({ data: { lease_ids: ["l1"] }, error: null })
    fromMock.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await createBailFirstRun(BAIL_INPUT)
    expect(res).toMatchObject({ ok: true, leaseId: "l1", dueId: null, dueAmount: 100000 })
  })
})

describe("recordPaymentFirstRun", () => {
  function happyRpc() {
    rpc
      .mockResolvedValueOnce({ data: "rec1", error: null }) // record_collection
      .mockResolvedValueOnce({ data: null, error: null }) // confirm_collection
      .mockResolvedValueOnce({ data: "r1", error: null }) // generate_receipt
    fromMock.mockReturnValueOnce(chain({ data: RECEIPT_ROW, error: null }))
  }

  it("chemin nominal : record -> confirm -> generate -> quittance reelle mappee", async () => {
    happyRpc()
    const res = await recordPaymentFirstRun(PAY_INPUT)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.receipt.receiptNumber).toBe("RNT-2026-0001")
      expect(res.receipt.kind).toBe("quittance")
      expect(res.receipt.periodLabel).toBe("juillet 2026")
      expect(res.receipt.verifyRef).toBe("ranti.app/recu/7d14099a-3037-4d0d-b8fd-00d53d905397")
      expect(res.receipt.tenantConfirmed).toBe(false)
      expect(res.receipt.sha256).toBeNull()
    }
    // L'allocation vise la 1re echeance, plafonnee au reste du.
    expect(rpc).toHaveBeenNthCalledWith(1, "record_collection", expect.objectContaining({
      p_allocations: [{ rent_due_id: "d1", amount_allocated: 100000 }],
      p_request_id: PAY_INPUT.requestId,
    }))
  })

  it("plafond d'allocation : montant > reste du -> allocation = reste du", async () => {
    happyRpc()
    await recordPaymentFirstRun({ ...PAY_INPUT, amount: "150000" })
    expect(rpc).toHaveBeenNthCalledWith(1, "record_collection", expect.objectContaining({
      p_allocations: [{ rent_due_id: "d1", amount_allocated: 100000 }],
    }))
  })

  it("sans echeance (dueId null) : encaissement sans allocation", async () => {
    happyRpc()
    await recordPaymentFirstRun({ ...PAY_INPUT, dueId: null, dueAmount: 0 })
    expect(rpc).toHaveBeenNthCalledWith(1, "record_collection", expect.objectContaining({
      p_allocations: [],
    }))
  })

  it("gardes d'entree : montant non numerique ou methode inconnue -> AUCUN appel RPC", async () => {
    expect(await recordPaymentFirstRun({ ...PAY_INPUT, amount: "100abc" })).toEqual({ ok: false, error: "Indiquez un montant valide." })
    expect(await recordPaymentFirstRun({ ...PAY_INPUT, method: "cheque" })).toEqual({ ok: false, error: "Methode de paiement invalide." })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("record_collection en echec -> message metier mappe", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "DUPLICATE_PAYMENT" } })
    const res = await recordPaymentFirstRun(PAY_INPUT)
    expect(res).toEqual({ ok: false, error: "Cet encaissement a deja ete enregistre." })
  })

  it("confirm en echec -> erreur, generate_receipt jamais appele", async () => {
    rpc
      .mockResolvedValueOnce({ data: "rec1", error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    const res = await recordPaymentFirstRun(PAY_INPUT)
    expect(res).toEqual({ ok: false, error: "Confirmation impossible. Reessayez." })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it("generate_receipt en echec -> erreur dediee", async () => {
    rpc
      .mockResolvedValueOnce({ data: "rec1", error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "nope" } })
    const res = await recordPaymentFirstRun(PAY_INPUT)
    expect(res).toEqual({ ok: false, error: "Quittance non editee. Reessayez." })
  })
})
