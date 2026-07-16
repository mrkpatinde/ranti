import { beforeEach, describe, expect, it, vi } from "vitest"

// redirect() de Next lève en vrai (never) : le mock DOIT lever aussi, sinon
// l'action continuerait après un `back(...)` et le test validerait un faux flux.
const { RedirectSignal, revalidatePath, requireLandlordProfile, rpc } = vi.hoisted(
  () => {
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
  },
)

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

import { verifyPaymentTransaction } from "../actions"

function form(entries: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

async function runAndCaptureRedirect(fd: FormData): Promise<string> {
  try {
    await verifyPaymentTransaction(fd)
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url
    throw err
  }
  throw new Error("verifyPaymentTransaction n'a pas redirigé")
}

const TX = "aa000000-0000-0000-0000-000000000001"

describe("verifyPaymentTransaction (ADR-018 v2 : validation propriétaire)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireLandlordProfile.mockResolvedValue({ id: "ll-1" })
  })

  it("transaction_id manquant : redirection erreur, RPC jamais appelée", async () => {
    const url = await runAndCaptureRedirect(form())
    expect(url).toBe(
      `/collections?error=${encodeURIComponent("Transaction introuvable.")}`,
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it("transaction_id blanc (espaces) : traité comme manquant", async () => {
    const url = await runAndCaptureRedirect(form({ transaction_id: "   " }))
    expect(url).toContain("/collections?error=")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("DUPLICATE_PAYMENT : message dédié à la déduplication cross-rail", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "DUPLICATE_PAYMENT: payment_reference déjà utilisée" },
    })
    const url = await runAndCaptureRedirect(form({ transaction_id: TX }))
    expect(url).toBe(
      `/collections?error=${encodeURIComponent(
        "Cet encaissement a déjà été enregistré (référence déjà utilisée).",
      )}`,
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("erreur RPC codée (transaction_not_pending) : message FR mappé", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "transaction_not_pending" },
    })
    const url = await runAndCaptureRedirect(form({ transaction_id: TX }))
    expect(url).toBe(
      `/collections?error=${encodeURIComponent(
        "Cette transaction a déjà été traitée.",
      )}`,
    )
  })

  it("erreur RPC inconnue : retombe sur le message technique", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "boom inattendu" },
    })
    const url = await runAndCaptureRedirect(form({ transaction_id: TX }))
    expect(url).toBe(
      `/collections?error=${encodeURIComponent("Validation impossible pour le moment. Réessayez.")}`,
    )
  })

  it("receptionId null : la RPC a re-rejeté → notice rejected, caches revalidés", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const url = await runAndCaptureRedirect(form({ transaction_id: TX }))
    expect(url).toBe("/collections?notice=payment_transaction_rejected")
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePath).toHaveBeenCalledWith("/collections")
    expect(revalidatePath).toHaveBeenCalledWith("/receipts")
  })

  it("succès : notice verified, RPC appelée avec le bon paramètre", async () => {
    rpc.mockResolvedValue({
      data: "rec-1",
      error: null,
    })
    const url = await runAndCaptureRedirect(form({ transaction_id: TX }))
    expect(url).toBe("/collections?notice=payment_transaction_verified")
    expect(rpc).toHaveBeenCalledWith("verify_payment_transaction", {
      p_transaction_id: TX,
    })
    expect(revalidatePath).toHaveBeenCalledTimes(3)
  })

  it("session exigée : requireLandlordProfile appelé avant toute lecture", async () => {
    rpc.mockResolvedValue({ data: "rec-1", error: null })
    await runAndCaptureRedirect(form({ transaction_id: TX }))
    expect(requireLandlordProfile).toHaveBeenCalled()
  })
})
