"use client"

// Modales du parcours FirstRun cablees a la base (phase 3) : nouveau bail (cree
// un vrai bail + echeances), valider un paiement (encaissement + quittance
// reelle), activation de relance (persistee), centre d'aide, quittance reelle.
// Aucun tiret cadratin (regle section 2 du CLAUDE.md handoff). Aucune valeur
// inventee : la quittance n'affiche que ce que le serveur renvoie (sec. 11).

import { useState } from "react"
import {
  type Action, type State, type PayTarget, oliveCta, ghostBtn, inputStyle, fieldLabel,
  fieldLabelSpan, CloseIcon, Wordmark, DefRow, ModalScrim,
} from "./shared"
import { useFirstRun } from "./context"

// Types de logement (valeurs UNIT_TYPES) avec libelles FR, repris tels quels de
// /leases/new (aucune divergence de vocabulaire).
const UNIT_TYPE_OPTIONS = [
  { value: "room", label: "Chambre" },
  { value: "apartment", label: "Appartement" },
  { value: "house", label: "Maison" },
  { value: "shop", label: "Boutique" },
  { value: "store", label: "Magasin" },
  { value: "office", label: "Bureau" },
  { value: "warehouse", label: "Entrepôt" },
  { value: "other", label: "Autre" },
]

const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Virement bancaire" },
]

function DialogStepper({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ padding: "20px 26px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: total }, (_, i) => {
          if (i < index) return <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--olive)" }} />
          if (i === index) return (
            <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--muted-surface)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: "55%", borderRadius: 999, background: "var(--olive)", transformOrigin: "left", animation: "fr-line var(--dur-medium) var(--ease-enter) both" }} />
            </span>
          )
          return <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--muted-surface)" }} />
        })}
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-muted)" }}>Étape {index + 1} sur {total}</span>
    </div>
  )
}

function ModalHeader({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "24px 26px 18px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "-0.02em", color: "var(--ink-title)" }}>{title}</h2>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-muted)" }}>{sub}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer" style={{ flexShrink: 0, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface-card)", color: "var(--ink-muted)", cursor: "pointer" }}><CloseIcon /></button>
    </div>
  )
}

const modalCard: React.CSSProperties = {
  width: 460, maxWidth: "100%", background: "var(--surface-card)", border: "1px solid var(--line)",
  borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-proof)", overflow: "hidden",
  animation: "fr-rise var(--dur-medium) var(--ease-enter) both",
}

// Encart d'erreur inline (reseau instable, terrain Android) : le message revient
// dans la modale, la saisie n'est jamais perdue.
function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={{ border: "1px solid var(--warning)", background: "var(--warning-wash)", color: "var(--warning)", borderRadius: "var(--radius-md)", padding: "11px 14px", fontSize: "0.85rem", lineHeight: 1.4 }}>{message}</div>
  )
}

const groupLabel: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-muted)" }

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null
  return el?.value?.trim() ?? ""
}

export function NouveauBailModal({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const { createBail } = useFirstRun()
  const first = state.formMode === "first"
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cle d'idempotence stable par ouverture de modale (#167) : un renvoi apres
  // timeout ne cree jamais un bail en double.
  const [requestId] = useState(() => crypto.randomUUID())

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const f = e.currentTarget
    setError(null)
    setPending(true)
    const res = await createBail({
      propertyName: fieldValue(f, "property_name"),
      propertyCity: fieldValue(f, "property_city"),
      unitName: fieldValue(f, "unit_name"),
      unitType: fieldValue(f, "unit_type"),
      firstName: fieldValue(f, "first_name"),
      lastName: fieldValue(f, "last_name"),
      phone: fieldValue(f, "phone"),
      email: fieldValue(f, "email"),
      monthlyRentAmount: fieldValue(f, "monthly_rent_amount"),
      dueDay: fieldValue(f, "due_day"),
      startDate: fieldValue(f, "start_date"),
      requestId,
    })
    if (res.ok) {
      dispatch({
        type: "save-tenant",
        name: res.tenantName,
        home: res.unitLabel,
        amount: res.amountLabel,
        refs: { leaseId: res.leaseId, unitId: res.unitId, tenantId: res.tenantId, dueId: res.dueId, dueAmount: res.dueAmount },
      })
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <ModalScrim>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} style={modalCard}>
        {first && <DialogStepper index={0} total={state.includeReminder ? 4 : 3} />}
        <ModalHeader title="Nouveau bail" sub="Ranti génère les échéances à partir de ces informations." onClose={() => dispatch({ type: "close-tenant-form" })} />
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18, maxHeight: "56vh", overflowY: "auto" }}>
          {error && <ErrorBanner message={error} />}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={groupLabel}>Lieu</span>
            <label style={fieldLabel}><span style={fieldLabelSpan}>Nom du lieu</span><input name="property_name" type="text" placeholder="Ex. Résidence Les Cocotiers" className="fr-in" style={inputStyle} /></label>
            <label style={fieldLabel}><span style={fieldLabelSpan}>Ville</span><input name="property_city" type="text" placeholder="Ex. Cotonou" className="fr-in" style={inputStyle} /></label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={groupLabel}>Logement</span>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Nom du logement</span><input name="unit_name" type="text" placeholder="Ex. Studio A1" className="fr-in" style={inputStyle} /></label>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Type</span>
                <select name="unit_type" className="fr-in" style={{ ...inputStyle, cursor: "pointer" }} defaultValue="">
                  <option value="" disabled>Choisir</option>
                  {UNIT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={groupLabel}>Locataire</span>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Prénom</span><input name="first_name" type="text" placeholder="Prénom" className="fr-in" style={inputStyle} /></label>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Nom</span><input name="last_name" type="text" placeholder="Nom" className="fr-in" style={inputStyle} /></label>
            </div>
            <label style={fieldLabel}><span style={fieldLabelSpan}>Téléphone</span><input name="phone" type="tel" inputMode="tel" placeholder="+229 01 23 45 67 89" className="fr-in" style={inputStyle} /></label>
            <label style={fieldLabel}><span style={fieldLabelSpan}>Email (facultatif)</span><input name="email" type="email" placeholder="Adresse email" className="fr-in" style={inputStyle} /></label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={groupLabel}>Bail</span>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Loyer mensuel</span><input name="monthly_rent_amount" type="text" inputMode="numeric" placeholder="100 000" className="fr-in" style={inputStyle} /></label>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 120 }}><span style={fieldLabelSpan}>Jour d&apos;échéance</span><input name="due_day" type="text" inputMode="numeric" placeholder="5" className="fr-in" style={inputStyle} /></label>
            </div>
            <label style={fieldLabel}><span style={fieldLabelSpan}>Date de début</span><input name="start_date" type="date" className="fr-in" style={inputStyle} /></label>
          </div>
        </div>
        <div style={{ padding: "18px 26px 24px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={pending} style={{ ...oliveCta, flex: 1, minWidth: 180, fontSize: "1rem", padding: "14px 24px", opacity: pending ? 0.7 : 1, cursor: pending ? "wait" : "pointer" }}>{pending ? "Enregistrement…" : "Enregistrer le bail"}</button>
          <button type="button" onClick={() => dispatch({ type: "close-tenant-form" })} style={{ ...ghostBtn, fontSize: "0.95rem", padding: "14px 12px" }}>Annuler</button>
        </div>
      </form>
    </ModalScrim>
  )
}

export function ValiderPaiementModal({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const { recordPayment, todayIso } = useFirstRun()
  const target: PayTarget | null = state.payTarget
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId] = useState(() => crypto.randomUUID())

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending || !target) return
    const f = e.currentTarget
    setError(null)
    setPending(true)
    const res = await recordPayment({
      tenantId: target.tenantId,
      unitId: target.unitId,
      dueId: target.dueId,
      dueAmount: target.dueAmount,
      amount: fieldValue(f, "montant"),
      method: fieldValue(f, "moyen"),
      receivedAt: fieldValue(f, "date") || null,
      requestId,
    })
    if (res.ok) {
      dispatch({ type: "save-payment", receipt: res.receipt })
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <ModalScrim>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} style={modalCard}>
        {target?.kind === "primary" && <DialogStepper index={1} total={state.includeReminder ? 4 : 3} />}
        <ModalHeader title="Valider un paiement" sub="Confirmez le règlement encaissé, Ranti édite la quittance." onClose={() => dispatch({ type: "close-payment-form" })} />
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <ErrorBanner message={error} />}
          <div style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line-soft)", background: "var(--muted-surface)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, background: "var(--olive)" }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 500, color: "var(--ink)" }}>{target?.name}</span>
              <span style={{ display: "block", fontSize: "0.82rem", color: "var(--ink-muted)" }}>{target?.home}</span>
            </span>
          </div>
          <label style={fieldLabel}><span style={fieldLabelSpan}>Montant reçu</span><input name="montant" type="text" inputMode="numeric" defaultValue={target && target.dueAmount > 0 ? String(target.dueAmount) : ""} placeholder="100 000" className="fr-in" style={inputStyle} /></label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Date de réception</span><input name="date" type="date" defaultValue={todayIso} max={todayIso} className="fr-in" style={inputStyle} /></label>
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Moyen</span>
              <select name="moyen" className="fr-in" style={{ ...inputStyle, cursor: "pointer" }} defaultValue="cash">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div style={{ padding: "0 26px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={pending} style={{ ...oliveCta, flex: 1, minWidth: 180, fontSize: "1rem", padding: "14px 24px", opacity: pending ? 0.7 : 1, cursor: pending ? "wait" : "pointer" }}>{pending ? "Validation…" : "Valider le paiement"}</button>
          <button type="button" onClick={() => dispatch({ type: "close-payment-form" })} style={{ ...ghostBtn, fontSize: "0.95rem", padding: "14px 12px" }}>Annuler</button>
        </div>
      </form>
    </ModalScrim>
  )
}

const MOMENTS: { id: "avant" | "echeance" | "retard"; label: string }[] = [
  { id: "avant", label: "3 jours avant l'échéance" },
  { id: "echeance", label: "Le jour de l'échéance" },
  { id: "retard", label: "En cas de retard" },
]

function CanalBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.92rem", fontWeight: 600, transition: "all var(--dur-short) var(--ease-standard)", border: active ? "1.5px solid var(--olive)" : "1.5px solid var(--line)", background: active ? "var(--olive-wash)" : "var(--surface-card)", color: active ? "var(--olive-deep)" : "var(--ink-muted)" }}>{label}</button>
  )
}

export function RelanceModal({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const { landlord } = useFirstRun()
  const canalLabel = state.relCanal === "whatsapp" ? "WhatsApp" : "SMS"
  const tenantFirst = state.lease.name.trim().split(/\s+/)[0] || "votre locataire"
  const previewAmount = state.lease.amount || "votre loyer"
  const previewHome = state.lease.home ? ` pour ${state.lease.home}` : ""
  return (
    <ModalScrim>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard, width: 480 }}>
        <DialogStepper index={3} total={4} />
        <div style={{ padding: "26px 28px 20px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--olive)" }}>Dernière étape</span>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em", lineHeight: 1.08, color: "var(--ink-title)" }}>Laissez Ranti relancer à votre place</h2>
          <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Le message part tout seul si le loyer n&apos;est pas réglé. Vous choisissez le canal et le moment.</p>
        </div>
        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>Canal</span>
            <div style={{ display: "flex", gap: 10 }}>
              <CanalBtn active={state.relCanal === "whatsapp"} label="WhatsApp" onClick={() => dispatch({ type: "pick-canal", canal: "whatsapp" })} />
              <CanalBtn active={state.relCanal === "sms"} label="SMS" onClick={() => dispatch({ type: "pick-canal", canal: "sms" })} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>Moment</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MOMENTS.map((mo) => {
                const sel = state.relMoment === mo.id
                return (
                  <button key={mo.id} type="button" onClick={() => dispatch({ type: "pick-moment", moment: mo.id })} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)", fontSize: "0.92rem", fontWeight: 500, transition: "all var(--dur-short) var(--ease-standard)", border: sel ? "1.5px solid var(--olive)" : "1.5px solid var(--line)", background: sel ? "var(--olive-wash)" : "var(--surface-card)", color: "var(--ink)" }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, boxSizing: "border-box", border: sel ? "2px solid var(--olive)" : "2px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 8, height: 8, borderRadius: 999, background: sel ? "var(--olive)" : "transparent" }} /></span>
                    {mo.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ border: "1px solid var(--line-soft)", background: "var(--muted-surface)", borderRadius: "var(--radius-md)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-muted)" }}>Aperçu {canalLabel}</span>
            <span style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--ink)" }}>Bonjour {tenantFirst}, votre loyer de {previewAmount}{previewHome} arrive à échéance. Merci de régler dès que possible. {landlord.firstName} (via Ranti)</span>
          </div>
        </div>
        <div style={{ padding: "0 28px 26px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => dispatch({ type: "activate-reminder" })} style={{ ...oliveCta, flex: 1, minWidth: 180, fontSize: "1rem", padding: "14px 24px" }}>Activer la relance</button>
          <button type="button" onClick={() => dispatch({ type: "skip-reminder" })} style={{ ...ghostBtn, fontSize: "0.95rem", padding: "14px 12px" }}>Plus tard</button>
        </div>
      </div>
    </ModalScrim>
  )
}

const GUIDES = ["Créer votre premier bail", "Valider un paiement et éditer la quittance", "Programmer les relances"]

export function CentreAideModal({ dispatch }: { dispatch: React.Dispatch<Action> }) {
  const close = () => dispatch({ type: "close-support" })
  return (
    <ModalScrim onClose={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard, width: 420 }}>
        <ModalHeader title="Aide Ranti" sub="Guides et réponses en français, dans le centre d'aide." onClose={close} />
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {GUIDES.map((g, i) => (
              <button key={g} type="button" onClick={close} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", textAlign: "left", border: 0, borderTop: i > 0 ? "1px solid var(--line-soft)" : undefined, background: "var(--surface-card)", padding: "13px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 500, color: "var(--ink)" }}>
                {g}
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, flexShrink: 0, color: "var(--ink-muted)" }} aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
          </div>
          <button type="button" onClick={close} style={{ ...oliveCta, fontSize: "1rem", padding: "14px 24px" }}>
            Ouvrir le centre d&apos;aide
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Le support WhatsApp arrive bientôt. En attendant, toutes les réponses sont dans le centre d&apos;aide.</p>
        </div>
      </div>
    </ModalScrim>
  )
}

const MONTHS_FR_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

// Format « 17 juillet 2026 » a partir d'un timestamptz ISO renvoye par le
// serveur. Rendu cote client uniquement (la modale ne s'affiche qu'apres action).
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MONTHS_FR_LONG[d.getMonth()]} ${d.getFullYear()}`
}

export function QuittanceModal({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const { landlord } = useFirstRun()
  const close = () => dispatch({ type: "close-quittance" })
  const r = state.receipt
  if (!r) return null

  const title = r.kind === "quittance" ? "Quittance de loyer" : "Reçu de paiement"
  const periodPhrase = r.periodLabel ? ` au titre du loyer de ${r.periodLabel}` : ""
  return (
    <ModalScrim onClose={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard, width: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "24px 26px 18px", borderBottom: "1px solid var(--line)" }}>
          <Wordmark size={30} subtitle="Registre de loyer" />
          <button type="button" onClick={close} aria-label="Fermer" style={{ flexShrink: 0, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface-card)", color: "var(--ink-muted)", cursor: "pointer" }}><CloseIcon /></button>
        </div>
        <div style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em", color: "var(--ink-title)" }}>{title}</h2>
              <span style={{ fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: "var(--ink-muted)" }}>N° {r.receiptNumber} · {formatDate(r.issuedAt)}</span>
            </div>
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--olive)" }} />Confirmée</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DefRow label="Bailleur" value={landlord.fullName} />
            {r.tenantName && <DefRow label="Locataire" value={r.tenantName} />}
            {r.unitLabel && <DefRow label="Logement" value={r.unitLabel} />}
            {r.periodLabel && <DefRow label="Période réglée" value={r.periodLabel} />}
            <DefRow label="Reçu le" value={formatDate(r.issuedAt)} />
          </div>
          <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>Montant réglé</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: "var(--ink-title)" }}>{r.amountLabel}</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Je soussigné(e) {landlord.fullName}, bailleur, reconnais avoir reçu la somme de <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{r.amountLabel}</strong>{periodPhrase}, dont quittance pour solde de ladite période.</p>
          <div style={{ border: "1px solid var(--line-soft)", background: "var(--muted-surface)", borderRadius: "var(--radius-md)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: "0.8rem", lineHeight: 1.45, color: "var(--ink-muted)" }}>{r.tenantConfirmed ? "Confirmée par le locataire." : "En attente de confirmation du locataire."} Vérifiable sur <span style={{ color: "var(--ink)", fontWeight: 500 }}>{r.verifyRef}</span></span>
            {r.sha256 && (
              <span style={{ fontSize: "0.8rem", lineHeight: 1.45, color: "var(--ink-muted)" }}>Empreinte SHA-256 <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: "0.72rem", color: "var(--ink)" }}>{r.sha256}</span></span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Le partage WhatsApp et l&apos;export PDF arrivent bientôt. La quittance est déjà consultable par votre locataire via son lien.</p>
        </div>
      </div>
    </ModalScrim>
  )
}
