import { beforeEach, describe, expect, it, vi } from "vitest"

// Consentement quittance électronique : l'action envoie le libellé VERBATIM
// (valeur probante), redirige vers la page après accord, et la garde des
// actions certify/contest renvoie vers l'écran de consentement tant que
// l'accord n'existe pas.
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
import { certifyReceipt, grantEreceiptConsent } from "../actions"

const TOKEN = "7d14099a-3037-4d0d-b8fd-00d53d905397"

beforeEach(() => vi.clearAllMocks())

describe("grantEreceiptConsent", () => {
  it("envoie le libellé exact à la RPC puis revient sur la page", async () => {
    rpc.mockResolvedValueOnce({ data: "2026-07-18T00:00:00Z", error: null })
    await expect(grantEreceiptConsent(TOKEN)).rejects.toThrow(`redirect:/recu/${TOKEN}`)
    expect(rpc).toHaveBeenCalledWith("grant_ereceipt_consent", {
      p_token: TOKEN,
      p_wording: ERECEIPT_CONSENT_WORDING,
    })
    expect(ERECEIPT_CONSENT_WORDING).toBe(
      "J'accepte de recevoir mes quittances de loyer au format électronique via Ranti.",
    )
  })

  it("erreur RPC : retour page avec message, jamais d'accord fantôme", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "not_found" } })
    await expect(grantEreceiptConsent(TOKEN)).rejects.toThrow(
      `redirect:/recu/${TOKEN}?error=action_failed`,
    )
  })
})

describe("garde de consentement sur certifyReceipt", () => {
  it("sans accord : renvoie vers la page (écran de consentement), ne certifie pas", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ found: true, granted_at: null, tenant_first_name: "Awa" }],
      error: null,
    })
    await expect(certifyReceipt(TOKEN)).rejects.toThrow(`redirect:/recu/${TOKEN}`)
    expect(rpc).toHaveBeenCalledTimes(1) // statut seulement, jamais certify
  })

  it("avec accord : la certification passe", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ found: true, granted_at: "2026-07-18T00:00:00Z", tenant_first_name: "Awa" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: "ok", error: null })
    await expect(certifyReceipt(TOKEN)).rejects.toThrow(`redirect:/recu/${TOKEN}`)
    expect(rpc).toHaveBeenNthCalledWith(2, "certify_receipt_by_token", { p_token: TOKEN })
  })
})
