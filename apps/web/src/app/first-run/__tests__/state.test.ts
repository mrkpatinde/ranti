import { beforeEach, describe, expect, it, vi } from "vitest"

// Machine d'etat FirstRun : le reducer pur pilote le parcours guide, la
// matrice runEffects decide QUAND persister (statut d'onboarding, reglages de
// relance, deconnexion). Ces contrats portent le flux de l'argent : un mauvais
// branchement et l'onboarding se termine trop tot ou jamais.
const { setOnboardingStatus, setReminderSettings, signOut } = vi.hoisted(() => ({
  setOnboardingStatus: vi.fn().mockResolvedValue(undefined),
  setReminderSettings: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/onboarding/actions", () => ({
  setOnboardingStatus: (...a: unknown[]) => setOnboardingStatus(...a),
}))
vi.mock("@/lib/reminders/actions", () => ({
  setReminderSettings: (...a: unknown[]) => setReminderSettings(...a),
}))
vi.mock("@/lib/auth/actions", () => ({
  signOut: (...a: unknown[]) => signOut(...a),
}))

import { makeFresh, reducer, runEffects } from "../state"
import type { LeaseRefs, PayTarget, ReceiptView, State } from "../shared"

const REFS: LeaseRefs = { leaseId: "l1", unitId: "u1", tenantId: "t1", dueId: "d1", dueAmount: 100000 }
const RECEIPT: ReceiptView = {
  receiptId: "r1", receiptNumber: "RNT-2026-0001", kind: "quittance", totalAmount: 100000,
  amountLabel: "100 000 FCFA", currency: "XOF", issuedAt: "2026-07-18T00:00:00Z",
  tenantName: "Awa Simon", unitLabel: "Chambre 1", periodLabel: "juillet 2026",
  verifyRef: "ranti.app/recu/tok", sha256: null, tenantConfirmed: false,
}
const PRIMARY: PayTarget = { kind: "primary", name: "Awa", home: "Chambre 1", ...REFS }
const ADDED: PayTarget = { kind: "added", addedId: "added-1", name: "Kofi", home: "Studio", ...REFS }

beforeEach(() => vi.clearAllMocks())

describe("reducer : parcours guide", () => {
  it("welcome -> setup -> lease -> reminder -> active (chemin nominal)", () => {
    let s = makeFresh("welcome")
    s = reducer(s, { type: "start-setup" })
    expect(s.step).toBe("setup")
    s = reducer(s, { type: "save-tenant", name: "Awa", home: "Chambre 1", amount: "100 000 FCFA", refs: REFS })
    expect(s.step).toBe("lease")
    expect(s.lease.leaseId).toBe("l1")
    s = reducer(s, { type: "open-payment-form", target: PRIMARY })
    s = reducer(s, { type: "save-payment", receipt: RECEIPT })
    expect(s.step).toBe("reminder") // includeReminder = true
    expect(s.receipt?.receiptNumber).toBe("RNT-2026-0001")
    s = reducer(s, { type: "activate-reminder" })
    expect(s.step).toBe("active")
    expect(s.relanceActive).toBe(true)
  })

  it("sans etape relance, save-payment va droit a active", () => {
    let s: State = { ...makeFresh("welcome"), includeReminder: false, payTarget: PRIMARY }
    s = reducer(s, { type: "save-payment", receipt: RECEIPT })
    expect(s.step).toBe("active")
  })

  it("save-tenant en mode tenant ajoute un bail sans changer d'etape", () => {
    let s: State = { ...makeFresh("welcome"), step: "active", formMode: "tenant" }
    s = reducer(s, { type: "save-tenant", name: "Kofi", home: "Studio", amount: "5 000 FCFA", refs: REFS })
    expect(s.step).toBe("active")
    expect(s.addedLeases).toHaveLength(1)
    expect(s.addedLeases[0]).toMatchObject({ id: "added-1", status: "due", leaseId: "l1" })
  })

  it("save-payment sur un bail ajoute le marque paye avec sa quittance, etape inchangee", () => {
    const base = {
      ...makeFresh("welcome"),
      step: "active" as const,
      payTarget: ADDED,
      addedLeases: [{ id: "added-1", name: "Kofi", home: "Studio", amount: "5 000", status: "due" as const, ...REFS }],
    }
    const s = reducer(base, { type: "save-payment", receipt: RECEIPT })
    expect(s.step).toBe("active")
    expect(s.addedLeases[0].status).toBe("paid")
    expect(s.addedLeases[0].receipt?.receiptId).toBe("r1")
  })

  it("skip -> explore, resume -> setup ; logout reinitialise tout", () => {
    let s = reducer(makeFresh("welcome"), { type: "skip" })
    expect(s.step).toBe("explore")
    s = reducer(s, { type: "resume" })
    expect(s.step).toBe("setup")
    s = reducer(s, { type: "logout" })
    expect(s).toEqual(makeFresh("welcome"))
  })

  it("open-quittance sans receipt garde la quittance courante", () => {
    const base = { ...makeFresh("welcome"), receipt: RECEIPT }
    const s = reducer(base, { type: "open-quittance" })
    expect(s.showQuittance).toBe(true)
    expect(s.receipt).toBe(RECEIPT)
  })
})

describe("runEffects : matrice de persistance", () => {
  it("skip -> exploring ; start-setup et resume -> guided", () => {
    runEffects({ type: "skip" }, makeFresh("welcome"))
    expect(setOnboardingStatus).toHaveBeenCalledWith("exploring")
    runEffects({ type: "start-setup" }, makeFresh("welcome"))
    runEffects({ type: "resume" }, makeFresh("welcome"))
    expect(setOnboardingStatus).toHaveBeenCalledWith("guided")
    expect(setOnboardingStatus).toHaveBeenCalledTimes(3)
  })

  it("activate-reminder persiste les reglages ET termine l'onboarding", () => {
    const s = { ...makeFresh("welcome"), relCanal: "sms" as const, relMoment: "retard" as const }
    runEffects({ type: "activate-reminder" }, s)
    expect(setReminderSettings).toHaveBeenCalledWith({ enabled: true, channel: "sms", moment: "retard" })
    expect(setOnboardingStatus).toHaveBeenCalledWith("done")
  })

  it("skip-reminder persiste enabled=false ET termine l'onboarding", () => {
    runEffects({ type: "skip-reminder" }, makeFresh("welcome"))
    expect(setReminderSettings).toHaveBeenCalledWith({ enabled: false, channel: "whatsapp", moment: "echeance" })
    expect(setOnboardingStatus).toHaveBeenCalledWith("done")
  })

  it("save-payment ne termine l'onboarding QUE sans etape relance et hors bail ajoute", () => {
    runEffects({ type: "save-payment", receipt: RECEIPT }, makeFresh("welcome")) // includeReminder=true
    expect(setOnboardingStatus).not.toHaveBeenCalled()
    runEffects({ type: "save-payment", receipt: RECEIPT }, { ...makeFresh("welcome"), includeReminder: false, payTarget: ADDED })
    expect(setOnboardingStatus).not.toHaveBeenCalled() // bail ajoute : onboarding deja en cours
    runEffects({ type: "save-payment", receipt: RECEIPT }, { ...makeFresh("welcome"), includeReminder: false, payTarget: PRIMARY })
    expect(setOnboardingStatus).toHaveBeenCalledWith("done")
  })

  it("pick-canal / pick-moment ne persistent que si la relance est active", () => {
    runEffects({ type: "pick-canal", canal: "sms" }, makeFresh("welcome")) // relanceActive=false
    expect(setReminderSettings).not.toHaveBeenCalled()
    runEffects({ type: "pick-canal", canal: "sms" }, { ...makeFresh("welcome"), relanceActive: true })
    expect(setReminderSettings).toHaveBeenCalledWith({ enabled: true, channel: "sms", moment: "echeance" })
    runEffects({ type: "pick-moment", moment: "avant" }, { ...makeFresh("welcome"), relanceActive: true, relCanal: "sms" })
    expect(setReminderSettings).toHaveBeenCalledWith({ enabled: true, channel: "sms", moment: "avant" })
  })

  it("toggle-relance persiste l'inverse de l'etat courant", () => {
    runEffects({ type: "toggle-relance" }, { ...makeFresh("welcome"), relanceActive: true })
    expect(setReminderSettings).toHaveBeenCalledWith({ enabled: false, channel: "whatsapp", moment: "echeance" })
  })

  it("logout appelle le signout Supabase ; la navigation ne persiste rien", () => {
    runEffects({ type: "logout" }, makeFresh("welcome"))
    expect(signOut).toHaveBeenCalledTimes(1)
    runEffects({ type: "set-view", view: "baux" }, makeFresh("welcome"))
    runEffects({ type: "toggle-menu" }, makeFresh("welcome"))
    expect(setOnboardingStatus).not.toHaveBeenCalled()
    expect(setReminderSettings).not.toHaveBeenCalled()
  })
})
