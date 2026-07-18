// Atomes partages du portage FirstRun (types, styles inline repris des valeurs
// du prototype, wordmark, icones). Importe par page.tsx, modals.tsx et views.tsx.
// Aucun tiret cadratin (regle section 2 du CLAUDE.md handoff). Phase 3 :
// l'identite reelle du bailleur vient du contexte (plus de seed), les baux et
// quittances portent des identifiants reels crees en base.

import type { FirstRunReceiptView } from "./actions"

export type Step = "welcome" | "explore" | "setup" | "lease" | "reminder" | "active"
export type View = "accueil" | "encaissements" | "relances" | "baux" | "parametres"
export type Canal = "whatsapp" | "sms"
export type Moment = "avant" | "echeance" | "retard"
export type FormMode = "first" | "tenant"

export type ReceiptView = FirstRunReceiptView

// Identifiants reels rattaches a un bail cree en base (phase 3).
export type LeaseRefs = {
  leaseId: string
  unitId: string
  tenantId: string
  dueId: string | null
  dueAmount: number
}

export type Lease = LeaseRefs & {
  id: string // cle locale de rendu
  name: string
  home: string
  amount: string
  status: "due" | "paid"
  receipt?: ReceiptView | null
}

// Bail principal du parcours guide : refs absentes tant qu'il n'est pas cree.
export type PrimaryLease = Partial<LeaseRefs> & { name: string; home: string; amount: string }

// Cible d'encaissement : le bail principal (guide) ou un bail ajoute ensuite.
export type PayTarget = LeaseRefs & {
  kind: "primary" | "added"
  addedId?: string
  name: string
  home: string
}

export type State = {
  step: Step
  view: View
  menuOpen: boolean
  includeReminder: boolean
  showQuittance: boolean
  showTenantForm: boolean
  formMode: FormMode
  showPaymentForm: boolean
  showSupport: boolean
  lease: PrimaryLease
  addedLeases: Lease[]
  payTarget: PayTarget | null
  receipt: ReceiptView | null
  relCanal: Canal
  relMoment: Moment
  relanceOn: boolean
  relanceActive: boolean
}

export type Action =
  | { type: "start-setup" }
  | { type: "skip" }
  | { type: "resume" }
  | { type: "set-view"; view: View }
  | { type: "toggle-menu" }
  | { type: "open-tenant-form"; mode: FormMode }
  | { type: "close-tenant-form" }
  | { type: "save-tenant"; name: string; home: string; amount: string; refs: LeaseRefs }
  | { type: "open-payment-form"; target: PayTarget }
  | { type: "close-payment-form" }
  | { type: "save-payment"; receipt: ReceiptView }
  | { type: "pick-canal"; canal: Canal }
  | { type: "pick-moment"; moment: Moment }
  | { type: "activate-reminder" }
  | { type: "skip-reminder" }
  | { type: "toggle-relance" }
  | { type: "open-support" }
  | { type: "close-support" }
  | { type: "open-quittance"; receipt?: ReceiptView | null }
  | { type: "close-quittance" }
  | { type: "restart" }
  | { type: "logout" }

export const oliveCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  color: "var(--accent-foreground)",
  background: "var(--olive)",
  boxShadow: "var(--shadow-cta)",
  border: 0,
  borderRadius: "var(--radius-full)",
  cursor: "pointer",
}

export const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  color: "var(--ink-muted)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-sans)",
  fontSize: "1rem",
  color: "var(--ink)",
  background: "var(--surface-card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  padding: "12px 16px",
  outline: "none",
}

export const fieldLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-sans)" }
export const fieldLabelSpan: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }

export const NAV: { id: View; label: string }[] = [
  { id: "accueil", label: "Accueil" },
  { id: "encaissements", label: "Encaissements" },
  { id: "relances", label: "Relances" },
  { id: "baux", label: "Baux" },
]

export function CheckIcon({ stroke = "var(--paper)", size = 14 }: { stroke?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden="true">
      <path d="M5 12.5l4 4 10-10" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ size = 34, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: size, height: size, flexShrink: 0, borderRadius: 10, background: "var(--ink)", display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.max(2, size / 10), padding: `0 ${size / 4}px` }}>
        <span style={{ height: 3, borderRadius: 2, background: "var(--paper)" }} />
        <span style={{ height: 3, width: "78%", borderRadius: 2, background: "var(--leaf)" }} />
        <span style={{ height: 3, width: "52%", borderRadius: 2, background: "var(--paper)" }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: `${size / 24}rem`, letterSpacing: "-0.02em", color: "var(--ink-title)", lineHeight: 1 }}>Ranti</span>
        {subtitle && <span style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{subtitle}</span>}
      </span>
    </div>
  )
}

export function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--ink)", textAlign: "right" }}>{value}</span>
    </div>
  )
}

export function navBtnStyle(active: boolean, fontSize: string): React.CSSProperties {
  return {
    textAlign: "left", width: "100%", border: 0, cursor: "pointer", fontFamily: "var(--font-sans)",
    display: "block", borderRadius: "var(--radius-full)", padding: "8px 14px", fontSize, fontWeight: 500,
    background: active ? "var(--ink)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--ink-muted)",
  }
}

// Overlay commun aux modales (scrim + centrage). Ferme au clic scrim si onClose.
export function ModalScrim({ onClose, children }: { onClose?: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(41,41,41,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(16px,5vw,40px)", overflowY: "auto", animation: "fr-fade var(--dur-short) var(--ease-standard) both", zIndex: 12 }}
    >
      {children}
    </div>
  )
}
