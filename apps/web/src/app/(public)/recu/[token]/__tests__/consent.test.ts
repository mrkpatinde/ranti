import { beforeEach, describe, expect, it, vi } from "vitest"

// Consentement quittance électronique v2 (2026-08-10) : plus d'écran séparé.
// La confirmation vaut acceptation — certifyReceipt enregistre l'accord
// (libellé VERBATIM, valeur probante) PUIS certifie, en une seule action
// locataire. La contestation, elle, ne consent à rien.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc }),
}))

import { ERECEIPT_CONSENT_WORDING } from "@/lib/receipts/consent"
import { certifyReceipt, contestReceipt } from "../actions"

const TOKEN = "7d14099a-3037-4d0d-b8fd-00d53d905397"

beforeEach(() => vi.clearAllMocks())

describe("certifyReceipt", () => {
  it("enregistre l'accord (libellé exact) puis certifie, une seule action", async () => {
    rpc
      .mockResolvedValueOnce({ data: "2026-08-10T00:00:00Z", error: null })
      .mockResolvedValueOnce({ data: "ok", error: null })

    await expect(certifyReceipt(TOKEN)).rejects.toThrow(`redirect:/recu/${TOKEN}`)

    expect(rpc).toHaveBeenNthCalledWith(1, "grant_ereceipt_consent", {
      p_token: TOKEN,
      p_wording: ERECEIPT_CONSENT_WORDING,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, "certify_receipt_by_token", { p_token: TOKEN })
    expect(ERECEIPT_CONSENT_WORDING).toBe(
      "En confirmant, vous acceptez de recevoir vos quittances par voie électronique.",
    )
  })

  it("échec de l'accord : retour page avec message, jamais de certification", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "not_found" } })

    await expect(certifyReceipt(TOKEN)).rejects.toThrow(
      `redirect:/recu/${TOKEN}?error=action_failed`,
    )
    expect(rpc).toHaveBeenCalledTimes(1) // consentement seulement, jamais certify
  })

  it("rejeu (déjà consenti) : l'accord write-once est inoffensif, certify passe", async () => {
    rpc
      // La RPC renvoie l'horodatage d'ORIGINE sur un rejeu (write-once).
      .mockResolvedValueOnce({ data: "2026-07-18T00:00:00Z", error: null })
      .mockResolvedValueOnce({ data: "ok", error: null })

    await expect(certifyReceipt(TOKEN)).rejects.toThrow(`redirect:/recu/${TOKEN}`)
    expect(rpc).toHaveBeenNthCalledWith(2, "certify_receipt_by_token", { p_token: TOKEN })
  })

  it("verdict non-ok : redirigé avec le code d'erreur de la RPC", async () => {
    rpc
      .mockResolvedValueOnce({ data: "2026-08-10T00:00:00Z", error: null })
      .mockResolvedValueOnce({ data: "already_certified", error: null })

    await expect(certifyReceipt(TOKEN)).rejects.toThrow(
      `redirect:/recu/${TOKEN}?error=already_certified`,
    )
  })
})

describe("contestReceipt", () => {
  it("conteste sans exiger ni enregistrer de consentement", async () => {
    rpc.mockResolvedValueOnce({ data: "ok", error: null })

    const form = new FormData()
    form.set("nature", "not_paid")

    await expect(contestReceipt(TOKEN, form)).rejects.toThrow(`redirect:/recu/${TOKEN}`)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("contest_receipt_by_token", {
      p_token: TOKEN,
      p_nature: "not_paid",
      p_amount: null,
      p_period: null,
    })
  })
})
