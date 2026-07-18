// Modales du portage FirstRun (FirstRun.dc.html) : nouveau bail, valider un
// paiement, activation de relance, centre d'aide, quittance. Etat local via
// dispatch. Copy des tirets cadratins remplaces par virgule / deux-points
// (regle section 2 du CLAUDE.md handoff).

import {
  SEED, type Action, type State, oliveCta, ghostBtn, inputStyle, fieldLabel,
  fieldLabelSpan, CloseIcon, Wordmark, DefRow, ModalScrim,
} from "./shared"

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

export function NouveauBailModal({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const first = state.formMode === "first"
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const el = e.currentTarget.elements as unknown as Record<string, HTMLInputElement>
    dispatch({
      type: "save-tenant",
      name: (el.occupant?.value || "").trim() || SEED.locataire,
      home: (el.logement?.value || "").trim() || SEED.logement,
      amount: (el.loyer?.value || "").trim() || SEED.montant,
    })
  }
  return (
    <ModalScrim>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} style={modalCard}>
        {first && <DialogStepper index={0} total={state.includeReminder ? 4 : 3} />}
        <ModalHeader title="Nouveau bail" sub="Ranti génère les échéances à partir de ces informations." onClose={() => dispatch({ type: "close-tenant-form" })} />
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={fieldLabel}><span style={fieldLabelSpan}>Occupant</span><input name="occupant" type="text" placeholder="Nom du locataire" className="fr-in" style={inputStyle} /></label>
          <label style={fieldLabel}><span style={fieldLabelSpan}>Logement</span><input name="logement" type="text" placeholder="Ex. Studio, Akpakpa" className="fr-in" style={inputStyle} /></label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Loyer mensuel</span><input name="loyer" type="text" inputMode="numeric" placeholder="100 000 FCFA" className="fr-in" style={inputStyle} /></label>
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Jour d&apos;échéance</span><input name="jour" type="text" inputMode="numeric" placeholder="5 du mois" className="fr-in" style={inputStyle} /></label>
          </div>
        </div>
        <div style={{ padding: "0 26px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={{ ...oliveCta, flex: 1, minWidth: 180, fontSize: "1rem", padding: "14px 24px" }}>Enregistrer le bail</button>
          <button type="button" onClick={() => dispatch({ type: "close-tenant-form" })} style={{ ...ghostBtn, fontSize: "0.95rem", padding: "14px 12px" }}>Annuler</button>
        </div>
      </form>
    </ModalScrim>
  )
}

export function ValiderPaiementModal({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <ModalScrim>
      <form onSubmit={(e) => { e.preventDefault(); dispatch({ type: "save-payment" }) }} onClick={(e) => e.stopPropagation()} style={modalCard}>
        <DialogStepper index={1} total={state.includeReminder ? 4 : 3} />
        <ModalHeader title="Valider un paiement" sub="Confirmez le règlement encaissé, Ranti édite la quittance." onClose={() => dispatch({ type: "close-payment-form" })} />
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line-soft)", background: "var(--muted-surface)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, background: "var(--olive)" }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 500, color: "var(--ink)" }}>{state.lease.name}</span>
              <span style={{ display: "block", fontSize: "0.82rem", color: "var(--ink-muted)" }}>{state.lease.home}</span>
            </span>
          </div>
          <label style={fieldLabel}><span style={fieldLabelSpan}>Montant reçu</span><input name="montant" type="text" inputMode="numeric" placeholder="100 000 FCFA" className="fr-in" style={inputStyle} /></label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Date de réception</span><input name="date" type="date" defaultValue="2026-07-16" max="2026-07-16" className="fr-in" style={inputStyle} /></label>
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}><span style={fieldLabelSpan}>Moyen</span><select name="moyen" className="fr-in" style={{ ...inputStyle, cursor: "pointer" }}><option>Espèces</option><option>Mobile Money</option><option>Virement bancaire</option></select></label>
          </div>
        </div>
        <div style={{ padding: "0 26px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={{ ...oliveCta, flex: 1, minWidth: 180, fontSize: "1rem", padding: "14px 24px" }}>Valider le paiement</button>
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
  const canalLabel = state.relCanal === "whatsapp" ? "WhatsApp" : "SMS"
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
            <span style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--ink)" }}>Bonjour Adjovi, votre loyer de 100 000 FCFA pour la Villa 3 ch, Fidjrossè arrive à échéance. Merci de régler dès que possible. Florentine (via Ranti)</span>
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

export function QuittanceModal({ dispatch }: { dispatch: React.Dispatch<Action> }) {
  const close = () => dispatch({ type: "close-quittance" })
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
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em", color: "var(--ink-title)" }}>Quittance de loyer</h2>
              <span style={{ fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: "var(--ink-muted)" }}>N° {SEED.ref} · 17 juillet 2026</span>
            </div>
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--olive)" }} />Confirmée</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DefRow label="Bailleur" value={SEED.bailleur} />
            <DefRow label="Locataire" value={SEED.locataire} />
            <DefRow label="Logement" value={SEED.logement} />
            <DefRow label="Période réglée" value="Juillet 2026" />
            <DefRow label="Reçu le" value="16 juillet 2026" />
          </div>
          <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>Montant réglé</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: "var(--ink-title)" }}>{SEED.montant}</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Je soussignée Florentine Dossou, bailleur, reconnais avoir reçu la somme de <strong style={{ color: "var(--ink)", fontWeight: 600 }}>cent mille francs CFA</strong> au titre du loyer de juillet 2026, dont quittance pour solde de ladite période.</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid var(--line-soft)", background: "var(--muted-surface)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <span aria-hidden="true" style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 8, background: "var(--surface-card)", border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gridTemplateRows: "repeat(5,1fr)", gap: 1, padding: 5 }}>
              {[1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1].map((on, i) => <span key={i} style={{ background: on ? "var(--ink)" : "transparent" }} />)}
            </span>
            <span style={{ fontSize: "0.8rem", lineHeight: 1.45, color: "var(--ink-muted)" }}>Confirmée par le locataire le 16 juillet 2026 · vérifiable sur ranti.app/q/{SEED.ref} · empreinte SHA-256 <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: "0.72rem", color: "var(--ink)" }}>c7a19b4e…d80f42e0</span></span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 2 }}>
            <button type="button" style={{ ...oliveCta, flex: 1, minWidth: 150, fontSize: "0.92rem", padding: "12px 18px" }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true"><path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.6-1.2A9 9 0 1012 3z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              Partager sur WhatsApp
            </button>
            <button type="button" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: "0.92rem", fontWeight: 600, color: "var(--ink)", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-full)", padding: "12px 18px", cursor: "pointer" }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              PDF
            </button>
          </div>
        </div>
      </div>
    </ModalScrim>
  )
}
