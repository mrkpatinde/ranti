"use client"

import { useCallback, useEffect, useReducer, useRef } from "react"
import "./first-run.css"
import { setOnboardingStatus } from "@/lib/onboarding/actions"
import { setReminderSettings } from "@/lib/reminders/actions"
import { signOut } from "@/lib/auth/actions"
import {
  type Action, type State, type Step, oliveCta, ghostBtn, NAV, navBtnStyle, Wordmark,
} from "./shared"
import { MainContent } from "./views"
import {
  NouveauBailModal, ValiderPaiementModal, RelanceModal, CentreAideModal, QuittanceModal,
} from "./modals"
import {
  FirstRunProvider, type FirstRunContextValue, type FirstRunLandlord,
} from "./context"
import { createBailFirstRun, recordPaymentFirstRun } from "./actions"

// Parcours FirstRun cable a la base (phase 3). Le reducer garde l'etat d'UI ;
// les ecritures reelles passent par les actions serveur : bail + paiement +
// quittance renvoient un resultat (contexte), tandis que statut d'onboarding,
// relances et deconnexion sont des effets « fire-and-forget » declenches par le
// dispatch enveloppe. Jamais bloquant : une erreur DB de statut/relance est
// seulement journalisee cote serveur, l'UI avance quand meme.

function makeFresh(step: Step): State {
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
    lease: { name: "", home: "", amount: "" },
    addedLeases: [],
    payTarget: null,
    receipt: null,
    relCanal: "whatsapp",
    relMoment: "echeance",
    relanceOn: false,
    relanceActive: false,
  }
}

function reducer(state: State, action: Action): State {
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
    case "restart":
      return makeFresh("welcome")
    case "logout":
      return makeFresh("welcome")
    default:
      return state
  }
}

// Effets de persistance declenches par le dispatch. Lit l'etat FRAIS (ref) pour
// composer les reglages de relance et decider quand l'onboarding est « done ».
function runEffects(action: Action, s: State) {
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

function Sidebar({ state, dispatch, landlord }: { state: State; dispatch: React.Dispatch<Action>; landlord: FirstRunLandlord }) {
  const showResume = state.step === "explore" || (state.step !== "active" && state.view !== "accueil")
  return (
    <aside style={{ borderRight: "1px solid var(--line)", background: "var(--surface-card)", padding: "22px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0 8px 20px" }}><Wordmark size={34} subtitle="Registre de loyer" /></div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
        {NAV.map((n) => <button key={n.id} type="button" onClick={() => dispatch({ type: "set-view", view: n.id })} style={navBtnStyle(state.view === n.id, "0.875rem")}>{n.label}</button>)}
      </nav>
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
        {showResume && (
          <button type="button" onClick={() => dispatch({ type: "resume" })} style={{ textAlign: "left", width: "100%", border: "1.5px solid var(--olive)", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 9, borderRadius: "var(--radius-full)", padding: "9px 14px", marginBottom: 12, fontSize: "0.85rem", fontWeight: 600, background: "var(--olive-wash)", color: "var(--olive-deep)" }}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true"><path d="M7 5v14l11-7z" fill="currentColor" /></svg>Reprendre la prise en main
          </button>
        )}
        <p style={{ margin: "0 0 4px", padding: "0 14px", fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.04em", color: "var(--ink-muted)" }}>AIDE</p>
        <button type="button" onClick={() => dispatch({ type: "open-support" })} style={navBtnStyle(false, "0.875rem")}>Centre d&apos;aide</button>
        <button type="button" onClick={() => dispatch({ type: "set-view", view: "parametres" })} style={navBtnStyle(state.view === "parametres", "0.875rem")}>Paramètres</button>
        <div style={{ padding: "10px 14px 2px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{landlord.fullName}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>Propriétaire</p>
          </div>
          <button type="button" onClick={() => dispatch({ type: "logout" })} aria-label="Se déconnecter" title="Se déconnecter" style={{ flexShrink: 0, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface-card)", color: "var(--ink-muted)", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} aria-hidden="true"><path d="M15 12H4m0 0l3.5-3.5M4 12l3.5 3.5M10 5V4h9v16h-9v-1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

function MobileHeader({ state, dispatch, landlord }: { state: State; dispatch: React.Dispatch<Action>; landlord: FirstRunLandlord }) {
  const showResume = state.step === "explore" || (state.step !== "active" && state.view !== "accueil")
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 4, borderBottom: "1px solid var(--line)", background: "var(--surface-card)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Wordmark size={28} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        <button type="button" onClick={() => dispatch({ type: "toggle-menu" })} aria-label="Menu" style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface-card)", color: "var(--ink)", cursor: "pointer" }}>
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem" }}>{landlord.initials}</span>
        {state.menuOpen && (
          <div style={{ position: "absolute", top: 48, right: 0, zIndex: 20, width: 220, background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow-proof)", padding: 6, display: "flex", flexDirection: "column", gap: 2, animation: "fr-fade var(--dur-short) var(--ease-standard) both" }}>
            {showResume && (
              <button type="button" onClick={() => dispatch({ type: "resume" })} style={{ textAlign: "left", width: "100%", border: "1.5px solid var(--olive)", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 9, borderRadius: "var(--radius-full)", padding: "9px 14px", marginBottom: 4, fontSize: "0.9rem", fontWeight: 600, background: "var(--olive-wash)", color: "var(--olive-deep)" }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true"><path d="M7 5v14l11-7z" fill="currentColor" /></svg>Reprendre la prise en main
              </button>
            )}
            {NAV.map((n) => <button key={n.id} type="button" onClick={() => dispatch({ type: "set-view", view: n.id })} style={navBtnStyle(state.view === n.id, "0.9rem")}>{n.label}</button>)}
            <div style={{ borderTop: "1px solid var(--line-soft)", margin: "4px 0", paddingTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              <button type="button" onClick={() => dispatch({ type: "open-support" })} style={navBtnStyle(false, "0.9rem")}>Centre d&apos;aide</button>
              <button type="button" onClick={() => dispatch({ type: "set-view", view: "parametres" })} style={navBtnStyle(state.view === "parametres", "0.9rem")}>Paramètres</button>
              <button type="button" onClick={() => dispatch({ type: "logout" })} style={navBtnStyle(false, "0.9rem")}>Se déconnecter</button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function WelcomeOverlay({ dispatch, landlord }: { dispatch: React.Dispatch<Action>; landlord: FirstRunLandlord }) {
  const steps = [
    { i: "1", t: "Enregistrez votre premier bail : logement, occupant, loyer." },
    { i: "2", t: "Validez un paiement dès que vous l'avez encaissé." },
    { i: "3", t: "Ranti édite la quittance, votre locataire la confirme." },
    { i: "4", t: "Programmez une relance WhatsApp le jour de l'échéance." },
  ]
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(41,41,41,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(16px,5vw,32px)", animation: "fr-fade var(--dur-short) var(--ease-standard) both", zIndex: 10 }}>
      <div style={{ position: "relative", width: 460, maxWidth: "100%", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-proof)", padding: "clamp(26px,5vw,36px) clamp(22px,4vw,34px)", display: "flex", flexDirection: "column", gap: 24, animation: "fr-rise var(--dur-medium) var(--ease-enter) both" }}>
        <button type="button" onClick={() => dispatch({ type: "skip" })} aria-label="Passer pour l'instant" style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface-card)", color: "var(--ink-muted)", cursor: "pointer" }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingRight: 28 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.55rem,5vw,1.85rem)", lineHeight: 1.06, letterSpacing: "-0.03em", color: "var(--ink-title)" }}>Bienvenue dans votre espace, {landlord.firstName}.</h1>
          <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.55, color: "var(--ink-muted)" }}>Voici votre registre de loyer. En quelques gestes, il se met à travailler pour vous.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((w) => (
            <div key={w.i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.82rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{w.i}</span>
              <span style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "var(--ink)" }}>{w.t}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
          <button type="button" onClick={() => dispatch({ type: "start-setup" })} style={{ ...oliveCta, flex: 1, minWidth: 180, fontSize: "1rem", padding: "15px 24px" }}>Commencer la configuration</button>
          <button type="button" onClick={() => dispatch({ type: "skip" })} style={{ ...ghostBtn, fontSize: "0.95rem", padding: "15px 12px" }}>Passer pour l&apos;instant</button>
        </div>
      </div>
    </div>
  )
}

export function FirstRunClient({
  landlord,
  monthLabel,
  todayIso,
  initialStep,
}: {
  landlord: FirstRunLandlord
  monthLabel: string
  todayIso: string
  initialStep: Step
}) {
  const [state, baseDispatch] = useReducer(reducer, initialStep, makeFresh)

  // Le dispatch enveloppe declenche les effets de persistance a partir de
  // l'etat FRAIS (ref, synchronisee en effet) avant de reduire. Le dispatch
  // n'est appele que depuis des gestionnaires d'evenements : la ref est alors a
  // jour (l'effet a deja commite).
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const dispatch = useCallback((action: Action) => {
    runEffects(action, stateRef.current)
    baseDispatch(action)
  }, [])

  // Les actions serveur sont des references stables : pas de useCallback.
  const ctx: FirstRunContextValue = {
    landlord,
    monthLabel,
    todayIso,
    createBail: createBailFirstRun,
    recordPayment: recordPaymentFirstRun,
  }

  return (
    <FirstRunProvider value={ctx}>
      <div className="fr-scope" style={{ position: "relative", minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(0px,3vw,28px)" }}>
        <div className="fr-desktop" style={{ width: "min(1180px,100%)", minHeight: 748, gridTemplateColumns: "240px 1fr", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: 20, boxShadow: "var(--shadow-proof)", overflow: "hidden" }}>
          <Sidebar state={state} dispatch={dispatch} landlord={landlord} />
          <div style={{ minWidth: 0, overflowY: "auto" }}><MainContent state={state} dispatch={dispatch} /></div>
        </div>

        <div className="fr-mobile" style={{ width: "100%", minHeight: "100vh", flexDirection: "column", background: "var(--surface-card)" }}>
          <MobileHeader state={state} dispatch={dispatch} landlord={landlord} />
          <div style={{ flex: 1, minWidth: 0 }}><MainContent state={state} dispatch={dispatch} /></div>
        </div>

        {state.step === "welcome" && <WelcomeOverlay dispatch={dispatch} landlord={landlord} />}
        {state.showTenantForm && <NouveauBailModal state={state} dispatch={dispatch} />}
        {state.showPaymentForm && <ValiderPaiementModal state={state} dispatch={dispatch} />}
        {state.step === "reminder" && <RelanceModal state={state} dispatch={dispatch} />}
        {state.showSupport && <CentreAideModal dispatch={dispatch} />}
        {state.showQuittance && <QuittanceModal state={state} dispatch={dispatch} />}
      </div>
    </FirstRunProvider>
  )
}
