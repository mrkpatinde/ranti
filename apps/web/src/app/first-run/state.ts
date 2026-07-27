import { setOnboardingStatus } from "@/lib/onboarding/actions"
import { setReminderSettings } from "@/lib/reminders/actions"
import { signOut } from "@/lib/auth/actions"
import type { Action, Canal, Lease, LeaseRefs, Moment, State, Step } from "./shared"

// Machine d'etat du parcours FirstRun (phase 3), extraite du composant client
// pour etre testable : reducer pur + matrice d'effets de persistance. Le
// composant (first-run-client.tsx) enveloppe dispatch pour appeler runEffects
// sur l'etat FRAIS avant de reduire.

// Reglages de relance persistes (landlords.reminders_enabled / channel /
// moment) : semes a l'initialisation pour que les toggles Relances/Parametres
// refletent la base et qu'un clic n'ecrase jamais un reglage existant avec
// les defauts d'UI (revue adversariale 2026-07-18, F4).
export type ReminderSeed = { active: boolean; canal: Canal; moment: Moment }

// Bails deja en base, semes au montage (migration 20260727180010 +
// getFirstRunSeed). Sans ca, un rechargement de /first-run repartait d'un ecran
// vide et le bailleur pouvait ressaisir un bail deja cree — doublon de
// logement et de locataire sur son premier contact avec le produit.
export type LeaseSeed = {
  primary: (LeaseRefs & { name: string; home: string; amount: string }) | null
  added: Lease[]
}

export function makeFresh(step: Step, reminders?: ReminderSeed, leases?: LeaseSeed): State {
  const primary = leases?.primary ?? null

  return {
    step,
    view: "accueil",
    menuOpen: false,
    includeReminder: true,
    showQuittance: false,
    showTenantForm: false,
    formMode: "first",
    showPaymentForm: false,
    showSupport: false,
    lease: primary
      ? {
          name: primary.name,
          home: primary.home,
          amount: primary.amount,
          leaseId: primary.leaseId,
          unitId: primary.unitId,
          tenantId: primary.tenantId,
          dueId: primary.dueId,
          dueAmount: primary.dueAmount,
        }
      : { name: "", home: "", amount: "" },
    addedLeases: leases?.added ?? [],
    payTarget: null,
    receipt: null,
    relCanal: reminders?.canal ?? "whatsapp",
    relMoment: reminders?.moment ?? "echeance",
    relanceOn: reminders?.active ?? false,
    relanceActive: reminders?.active ?? false,
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start-setup":
      return { ...state, step: "setup", menuOpen: false }
    case "skip":
      return { ...state, step: "explore", menuOpen: false }
    case "resume":
      return { ...state, step: state.step === "explore" ? "setup" : state.step, view: "accueil", menuOpen: false }
    case "set-view":
      return { ...state, view: action.view, menuOpen: false, step: state.step === "welcome" ? "setup" : state.step }
    case "toggle-menu":
      return { ...state, menuOpen: !state.menuOpen }
    case "open-tenant-form":
      return { ...state, showTenantForm: true, formMode: action.mode, menuOpen: false }
    case "close-tenant-form":
      return { ...state, showTenantForm: false }
    case "save-tenant":
      if (state.formMode === "first") {
        return { ...state, showTenantForm: false, step: "lease", lease: { name: action.name, home: action.home, amount: action.amount, ...action.refs } }
      }
      return {
        ...state,
        showTenantForm: false,
        addedLeases: [...state.addedLeases, { id: `added-${state.addedLeases.length + 1}`, name: action.name, home: action.home, amount: action.amount, status: "due", ...action.refs }],
      }
    case "open-payment-form":
      return { ...state, showPaymentForm: true, payTarget: action.target }
    case "close-payment-form":
      return { ...state, showPaymentForm: false }
    case "save-payment":
      if (state.payTarget?.kind === "added") {
        const addedId = state.payTarget.addedId
        return {
          ...state,
          showPaymentForm: false,
          receipt: action.receipt,
          addedLeases: state.addedLeases.map((l) => (l.id === addedId ? { ...l, status: "paid", receipt: action.receipt } : l)),
        }
      }
      return { ...state, showPaymentForm: false, receipt: action.receipt, step: state.includeReminder ? "reminder" : "active" }
    case "pick-canal":
      return { ...state, relCanal: action.canal }
    case "pick-moment":
      return { ...state, relMoment: action.moment }
    case "activate-reminder":
      return { ...state, step: "active", relanceOn: true, relanceActive: true, menuOpen: false }
    case "skip-reminder":
      return { ...state, step: "active", relanceOn: false, menuOpen: false }
    case "toggle-relance":
      return { ...state, relanceActive: !state.relanceActive }
    case "open-support":
      return { ...state, showSupport: true, menuOpen: false, step: state.step === "welcome" ? "setup" : state.step }
    case "close-support":
      return { ...state, showSupport: false }
    case "open-quittance":
      return { ...state, showQuittance: true, receipt: action.receipt ?? state.receipt }
    case "close-quittance":
      return { ...state, showQuittance: false }
    case "logout":
      return makeFresh("welcome")
    default:
      return state
  }
}

// Effets de persistance declenches par le dispatch. Lit l'etat FRAIS pour
// composer les reglages de relance et decider quand l'onboarding est « done ».
export function runEffects(action: Action, s: State) {
  switch (action.type) {
    case "skip":
      void setOnboardingStatus("exploring")
      break
    case "start-setup":
    case "resume":
      void setOnboardingStatus("guided")
      break
    case "save-payment":
      // Sans etape relance, valider le paiement termine l'onboarding.
      if (!s.includeReminder && s.payTarget?.kind !== "added") void setOnboardingStatus("done")
      break
    case "activate-reminder":
      void setReminderSettings({ enabled: true, channel: s.relCanal, moment: s.relMoment })
      void setOnboardingStatus("done")
      break
    case "skip-reminder":
      void setReminderSettings({ enabled: false, channel: s.relCanal, moment: s.relMoment })
      void setOnboardingStatus("done")
      break
    case "toggle-relance":
      void setReminderSettings({ enabled: !s.relanceActive, channel: s.relCanal, moment: s.relMoment })
      break
    case "pick-canal":
      if (s.relanceActive) void setReminderSettings({ enabled: true, channel: action.canal, moment: s.relMoment })
      break
    case "pick-moment":
      if (s.relanceActive) void setReminderSettings({ enabled: true, channel: s.relCanal, moment: action.moment })
      break
    case "logout":
      void signOut()
      break
    default:
      break
  }
}
