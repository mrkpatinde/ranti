import { beforeEach, describe, expect, it, vi } from "vitest"

// setReminderSettings (FirstRun phase 3) : update direct sous RLS, jamais
// bloquant. Contrats testés : entrée invalide = zéro toucher DB ; erreur DB
// journalisée mais jamais propagée ; écriture limitée aux trois colonnes
// non-identité, scopée sur l'id du bailleur.
const { revalidatePath, requireLandlordProfile, update, eq, rpc } = vi.hoisted(() => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  return {
    revalidatePath: vi.fn(),
    requireLandlordProfile: vi.fn().mockResolvedValue({ id: "landlord-1" }),
    update,
    eq,
    rpc: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

// redirect jette : toute redirection réintroduite dans cancelScheduledReminder
// (ancien contrat) fait échouer les tests de retour d'état ci-dessous.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))

vi.mock("@/lib/landlords", () => ({
  requireLandlordProfile: () => requireLandlordProfile(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({ update })),
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}))

import { cancelScheduledReminder, setReminderSettings } from "../actions"

function fd(entries: Record<string, string> = {}): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  requireLandlordProfile.mockResolvedValue({ id: "landlord-1" })
  eq.mockResolvedValue({ error: null })
  // Reset complet du RPC : sans lui, une valeur posée par un test fuirait
  // dans le suivant (clearAllMocks garde les implémentations).
  rpc.mockReset()
  rpc.mockResolvedValue({ error: null })
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

// Annulation d'une relance programmée : retour d'état { error } au lieu de
// rediriger. C'est le contrat sur lequel repose le rollback optimiste de
// ScheduledReminders (la ligne masquée est restaurée et l'erreur affichée si
// error != null ; la revalidation apporte l'état réel en cas de succès).
describe("cancelScheduledReminder (retour d'état, rollback optimiste)", () => {
  it("id manquant : erreur dédiée, RPC jamais appelée, pas de revalidation", async () => {
    await expect(cancelScheduledReminder(fd())).resolves.toEqual({
      error: "Relance introuvable.",
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("le profil bailleur est exigé avant toute lecture du formulaire", async () => {
    requireLandlordProfile.mockRejectedValue(new Error("redirect:/onboarding"))
    await expect(cancelScheduledReminder(fd({ id: "sr-1" }))).rejects.toThrow(
      "redirect:/onboarding",
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it("code RPC connu (not_pending) : message dédié ET /reminders revalidé (purge la ligne fantôme)", async () => {
    rpc.mockResolvedValue({ error: { message: "P0001: not_pending" } })
    await expect(cancelScheduledReminder(fd({ id: "sr-1" }))).resolves.toEqual({
      error: "Cette relance a déjà été envoyée ou annulée.",
    })
    // not_pending = la ligne a été envoyée/annulée ailleurs : la revalidation
    // remplace le retour optimiste par l'état réel au lieu de restaurer une
    // ligne qui n'existe plus côté serveur.
    expect(revalidatePath).toHaveBeenCalledWith("/reminders")
  })

  it("erreur RPC inconnue : repli dédié à l'ANNULATION, /reminders revalidé", async () => {
    rpc.mockResolvedValue({ error: { message: "connection reset by peer" } })
    await expect(cancelScheduledReminder(fd({ id: "sr-1" }))).resolves.toEqual({
      error: "Annulation impossible. Réessayez.",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/reminders")
  })

  it("succès : { error: null }, RPC ciblée sur l'id, /reminders revalidé, zéro redirect", async () => {
    rpc.mockResolvedValue({ error: null })
    await expect(cancelScheduledReminder(fd({ id: "sr-1" }))).resolves.toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("cancel_scheduled_reminder", { p_id: "sr-1" })
    expect(revalidatePath).toHaveBeenCalledWith("/reminders")
  })
})
