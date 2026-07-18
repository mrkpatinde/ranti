import { beforeEach, describe, expect, it, vi } from "vitest"

// setReminderSettings (FirstRun phase 3) : update direct sous RLS, jamais
// bloquant. Contrats testés : entrée invalide = zéro toucher DB ; erreur DB
// journalisée mais jamais propagée ; écriture limitée aux trois colonnes
// non-identité, scopée sur l'id du bailleur.
const { revalidatePath, requireLandlordProfile, update, eq } = vi.hoisted(() => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  return {
    revalidatePath: vi.fn(),
    requireLandlordProfile: vi.fn().mockResolvedValue({ id: "landlord-1" }),
    update,
    eq,
  }
})

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

vi.mock("@/lib/landlords", () => ({
  requireLandlordProfile: () => requireLandlordProfile(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({ update })),
  }),
}))

import { setReminderSettings } from "../actions"

beforeEach(() => {
  vi.clearAllMocks()
  requireLandlordProfile.mockResolvedValue({ id: "landlord-1" })
  eq.mockResolvedValue({ error: null })
})

describe("setReminderSettings", () => {
  it("écrit les trois colonnes non-identité, scopées sur le bailleur", async () => {
    await setReminderSettings({ enabled: true, channel: "whatsapp", moment: "echeance" })
    expect(update).toHaveBeenCalledWith({
      reminders_enabled: true,
      reminder_channel: "whatsapp",
      reminder_moment: "echeance",
    })
    expect(eq).toHaveBeenCalledWith("id", "landlord-1")
    expect(revalidatePath).toHaveBeenCalledWith("/reminders")
  })

  it("canal invalide : aucun toucher DB, pas même l'auth", async () => {
    await setReminderSettings({
      // @ts-expect-error entrée hostile volontaire
      channel: "pigeon",
      enabled: true,
      moment: "echeance",
    })
    expect(update).not.toHaveBeenCalled()
    expect(requireLandlordProfile).not.toHaveBeenCalled()
  })

  it("moment invalide : aucun toucher DB", async () => {
    await setReminderSettings({
      enabled: false,
      channel: "sms",
      // @ts-expect-error entrée hostile volontaire
      moment: "aube",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("erreur DB : journalisée, jamais propagée (jamais bloquant)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    eq.mockResolvedValue({ error: { code: "42501", message: "denied" } })
    await expect(
      setReminderSettings({ enabled: true, channel: "sms", moment: "retard" }),
    ).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
