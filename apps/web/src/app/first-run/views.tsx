// Vues du portage FirstRun (FirstRunMain.dc.html) : accueil + encaissements,
// relances, baux, parametres. Modele derive de l'etat local (seed + baux
// ajoutes). Copy sans tiret cadratin (section 2 du CLAUDE.md handoff).

import {
  SEED, type Action, type State, type Lease, oliveCta, ghostBtn, CheckIcon,
} from "./shared"

// ---- modele partage ----

type Row = { id: string; name: string; home: string; amount: string; status: "due" | "paid" | "late" }

function num(s: string) {
  return parseInt(s.replace(/[^\d]/g, ""), 10) || 0
}
function fmt(n: number) {
  return n ? n.toLocaleString("fr-FR") : "0"
}

function allRows(state: State): Row[] {
  const rows: Row[] = []
  const hasPrimary = state.step === "lease" || state.step === "reminder" || state.step === "active"
  if (hasPrimary) {
    const paid = state.step === "reminder" || state.step === "active"
    rows.push({ id: "primary", name: state.lease.name, home: state.lease.home, amount: state.lease.amount, status: paid ? "paid" : "due" })
  }
  state.addedLeases.forEach((l: Lease) => rows.push({ id: l.id, name: l.name, home: l.home, amount: l.amount, status: l.status }))
  return rows
}

function totals(rows: Row[]) {
  let paid = 0, due = 0, late = 0
  rows.forEach((r) => { const v = num(r.amount); if (r.status === "paid") paid += v; else if (r.status === "late") late += v; else due += v })
  return { paid, due, late }
}

function accueilModel(state: State) {
  const step = state.step
  const stageEmpty = step === "welcome" || step === "setup"
  const stageExplore = step === "explore"
  const stageLease = step === "lease"
  const stagePaid = step === "reminder" || step === "active"
  const stageActive = step === "active"

  const doneCreate = stageLease || stagePaid
  const doneValidate = stagePaid
  const doneQuittance = stagePaid

  const base = [
    { key: "lease", label: "Créer votre premier bail", desc: "Le logement, l'occupant, le loyer mensuel.", done: doneCreate, active: !doneCreate },
    { key: "payment", label: "Valider un paiement reçu", desc: "Vous encaissez, Ranti enregistre le règlement.", done: doneValidate, active: doneCreate && !doneValidate },
    { key: "receipt", label: "Recevoir la première quittance", desc: "Numérotée, votre locataire la confirme en ligne.", done: doneQuittance, active: false },
  ]
  if (state.includeReminder) base.push({ key: "reminder", label: "Programmer une relance", desc: "WhatsApp, le jour de l'échéance.", done: stageActive, active: step === "reminder" })
  const steps = base.map((s) => ({ ...s, locked: !s.done && !s.active }))

  const total = steps.length
  const doneCount = steps.filter((s) => s.done).length
  const t = totals(allRows(state))

  return {
    stageEmpty, stageExplore, stageLease, stagePaid, stageActive,
    steps, total, doneCount,
    showChecklist: !stageActive && !stageExplore,
    checklistTitle: doneCount === 0 ? "Activez votre espace" : "Presque prêt",
    checklistSub: doneCount === 0 ? "Quelques gestes, et Ranti prend le relais." : "Continuez, il ne reste qu'un geste.",
    paid: t.paid, due: t.due, late: t.late,
  }
}

// ---- atomes de vue ----

function StepCircle({ s }: { s: { done: boolean; active: boolean } }) {
  if (s.done) return <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, background: "var(--olive)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><CheckIcon /></span>
  if (s.active) return <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, boxSizing: "border-box", border: "2px solid var(--olive)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, animation: "fr-pulse 2s var(--ease-standard) infinite" }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--olive)" }} /></span>
  return <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, boxSizing: "border-box", border: "2px solid var(--line)", marginTop: 1 }} />
}

function LedgerStrip({ paid, due, late }: { paid: number; due: number; late: number }) {
  const cell = (label: string, value: number, color: string, first?: boolean) => (
    <div style={{ flex: 1, minWidth: 0, padding: "clamp(12px,2.5vw,18px) clamp(12px,2.5vw,20px)", display: "flex", flexDirection: "column", gap: 6, borderLeft: first ? undefined : "1px solid var(--line)" }}>
      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.2rem,4.2vw,1.5rem)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: value > 0 ? color : "var(--ink-muted)" }}>{fmt(value)}</span>
    </div>
  )
  return (
    <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" }}>
      {cell("Payé", paid, "var(--olive-deep)", true)}
      {cell("Attendu", due, "var(--ink)")}
      {cell("Retard", late, "var(--warning)")}
    </div>
  )
}

const sectionTitle: React.CSSProperties = { margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--ink-muted)" }
const mainWrap: React.CSSProperties = { maxWidth: 620, margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,3vw,32px) clamp(40px,6vw,64px)", display: "flex", flexDirection: "column", gap: "clamp(22px,3vw,30px)" }

function ViewHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.9rem,6vw,2.5rem)", letterSpacing: "-0.03em", lineHeight: 1.04, color: "var(--ink-title)" }}>{title}</h1>
      {subtitle && <p style={{ margin: "8px 0 0", fontSize: "0.95rem", color: "var(--ink-muted)" }}>{subtitle}</p>}
    </header>
  )
}

function EmptyLease({ title, body, cta, onCta }: { title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div style={{ border: "1px dashed var(--line)", borderRadius: "var(--radius-lg)", padding: "clamp(24px,4vw,30px) 24px", display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--ink-title)" }}>{title}</span>
        <span style={{ fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>{body}</span>
      </div>
      <button type="button" onClick={onCta} style={{ ...oliveCta, fontSize: "1rem", padding: "14px 26px" }}>{cta}</button>
    </div>
  )
}

// ---- ACCUEIL ----

function Accueil({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const m = accueilModel(state)
  return (
    <main style={mainWrap}>
      <ViewHeader title="Bonjour Florentine" subtitle="juillet 2026" />

      {m.showChecklist && (
        <section style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", boxShadow: "var(--shadow-cta)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-0.01em", color: "var(--ink-title)" }}>{m.checklistTitle}</h2>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-muted)" }}>{m.checklistSub}</p>
            </div>
            <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.1rem", fontVariantNumeric: "tabular-nums", color: "var(--olive)" }}>{m.doneCount}/{m.total}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {m.steps.map((s) => (
              <div key={s.key} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "15px 22px", borderTop: "1px solid var(--line-soft)" }}>
                <StepCircle s={s} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: s.done ? 500 : 600, color: s.done ? "var(--ink-muted)" : "var(--ink)", textDecoration: s.done ? "line-through var(--line)" : "none" }}>{s.label}</span>
                  <span style={{ fontSize: "0.82rem", lineHeight: 1.45, color: "var(--ink-muted)" }}>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <LedgerStrip paid={m.paid} due={m.due} late={m.late} />

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={sectionTitle}>{m.stagePaid ? "Réglé ce mois" : "À encaisser"}</h2>

        {m.stageEmpty && <EmptyLease title="Aucun bail pour l'instant." body="Créez votre premier bail : Ranti génère les échéances et prépare les relances." cta="Créer mon premier bail" onCta={() => dispatch({ type: "open-tenant-form", mode: "first" })} />}

        {m.stageExplore && (
          <div style={{ border: "1px dashed var(--line)", borderRadius: "var(--radius-lg)", padding: "clamp(24px,4vw,30px) 24px", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", textAlign: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--ink-title)" }}>Votre registre est prêt quand vous l&apos;êtes.</span>
              <span style={{ fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Regardez tranquillement. Le jour où vous ajoutez un bail, Ranti génère les échéances et prépare les quittances, rien n&apos;est obligatoire pour l&apos;instant.</span>
            </div>
            <button type="button" onClick={() => dispatch({ type: "open-tenant-form", mode: "first" })} style={{ ...oliveCta, fontSize: "1rem", padding: "14px 26px" }}>Créer un bail</button>
            <button type="button" onClick={() => dispatch({ type: "resume" })} style={{ ...ghostBtn, padding: 4, fontSize: "0.88rem", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>Reprendre la prise en main guidée</button>
          </div>
        )}

        {m.stageLease && <LeaseCardDue state={state} dispatch={dispatch} />}
        {m.stagePaid && <LeaseCardPaid state={state} dispatch={dispatch} />}
      </section>

      {m.stageActive && (
        <section style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: 22, display: "flex", flexDirection: "column", gap: 16, animation: "fr-rise var(--dur-medium) var(--ease-enter) .1s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 14, background: "var(--ink)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, padding: "0 12px" }}>
              <span style={{ height: 4, borderRadius: 2, background: "var(--paper)" }} />
              <span style={{ height: 4, width: "78%", borderRadius: 2, background: "var(--leaf)" }} />
              <span style={{ height: 4, width: "52%", borderRadius: 2, background: "var(--paper)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "-0.02em", color: "var(--ink-title)" }}>Votre espace est actif.</h2>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Un bail enregistré, un paiement validé, une quittance éditée. Tout est à jour ce mois-ci.</p>
            </div>
          </div>
          {state.relanceOn && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid var(--olive)", background: "var(--olive-wash)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
              <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: "var(--olive)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, animation: "fr-pop var(--dur-medium) var(--ease-enter) both" }}><CheckIcon size={15} /></span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--olive-deep)" }}>Relance activée</span>
                <span style={{ fontSize: "0.85rem", lineHeight: 1.45, color: "var(--ink)" }}>Ranti enverra le message par {state.relCanal === "whatsapp" ? "WhatsApp" : "SMS"} le jour de l&apos;échéance. Vous n&apos;avez plus rien à faire.</span>
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink)" }}>Ajoutez un autre locataire pour suivre tous vos loyers au même endroit.</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => dispatch({ type: "open-tenant-form", mode: "tenant" })} style={{ ...oliveCta, fontSize: "0.95rem", padding: "13px 22px" }}>Ajouter un locataire</button>
              <button type="button" onClick={() => dispatch({ type: "restart" })} style={{ ...ghostBtn, padding: 6, fontSize: "0.88rem", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>Rejouer la prise en main</button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function LeaseCardDue({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)", animation: "fr-rise var(--dur-medium) var(--ease-enter) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: "var(--olive)" }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: "1.05rem", fontWeight: 500, color: "var(--ink)" }}>{state.lease.name}</span>
          <span style={{ display: "block", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{state.lease.home} · attendu</span>
        </span>
        <span style={{ fontSize: "0.95rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)", whiteSpace: "nowrap" }}>{state.lease.amount}</span>
      </div>
      <div style={{ borderTop: "1px solid var(--line-soft)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--muted-surface)" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Vous avez encaissé ce loyer ?</span>
        <button type="button" onClick={() => dispatch({ type: "open-payment-form" })} style={{ ...oliveCta, fontSize: "0.92rem", padding: "11px 20px", animation: "fr-pulse 2s var(--ease-standard) infinite" }}>Valider le paiement</button>
      </div>
    </div>
  )
}

function LeaseCardPaid({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)", animation: "fr-rise var(--dur-medium) var(--ease-enter) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: "var(--olive)" }} />
        <span style={{ minWidth: 120, flex: 1 }}>
          <span style={{ display: "block", fontSize: "1.05rem", fontWeight: 500, color: "var(--ink)" }}>{state.lease.name}</span>
          <span style={{ display: "block", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{state.lease.home} · à jour</span>
        </span>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--olive)" }} />Quittance {SEED.ref}</span>
      </div>
      <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 20px", display: "flex", justifyContent: "flex-end", background: "var(--muted-surface)" }}>
        <button type="button" onClick={() => dispatch({ type: "open-quittance" })} style={{ ...ghostBtn, color: "var(--olive)", padding: "4px 2px", fontSize: "0.9rem", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>Voir la quittance</button>
      </div>
    </div>
  )
}

// ---- ENCAISSEMENTS ----

function Encaissements({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const rows = allRows(state)
  const t = totals(rows)
  return (
    <main style={mainWrap}>
      <ViewHeader title="Encaissements" subtitle="Vos loyers de juillet 2026" />
      <LedgerStrip paid={t.paid} due={t.due} late={t.late} />
      {rows.length === 0 ? (
        <EmptyLease title="Aucun encaissement pour l'instant." body="Créez un bail : les échéances apparaîtront ici, prêtes à encaisser." cta="Créer un bail" onCta={() => dispatch({ type: "open-tenant-form", mode: "first" })} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={sectionTitle}>Loyers de juillet</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map((r) => r.status === "paid" ? (
              <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: "var(--olive)" }} />
                  <span style={{ minWidth: 120, flex: 1 }}><span style={{ display: "block", fontSize: "1.05rem", fontWeight: 500, color: "var(--ink)" }}>{r.name}</span><span style={{ display: "block", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{r.home} · réglé ce mois</span></span>
                  <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--olive)" }} />Quittance {SEED.ref}</span>
                </div>
                <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 20px", display: "flex", justifyContent: "flex-end", background: "var(--muted-surface)" }}>
                  <button type="button" onClick={() => dispatch({ type: "open-quittance" })} style={{ ...ghostBtn, color: "var(--olive)", padding: "4px 2px", fontSize: "0.9rem", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>Voir la quittance</button>
                </div>
              </div>
            ) : (
              <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: "var(--olive)" }} />
                  <span style={{ minWidth: 120, flex: 1 }}><span style={{ display: "block", fontSize: "1.05rem", fontWeight: 500, color: "var(--ink)" }}>{r.name}</span><span style={{ display: "block", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{r.home} · loyer attendu</span></span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)", whiteSpace: "nowrap" }}>{r.amount}</span>
                </div>
                <div style={{ borderTop: "1px solid var(--line-soft)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--muted-surface)" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Vous avez encaissé ce loyer ?</span>
                  <button type="button" onClick={() => r.id === "primary" ? dispatch({ type: "open-payment-form" }) : dispatch({ type: "validate-added", id: r.id })} style={{ ...oliveCta, fontSize: "0.92rem", padding: "11px 20px" }}>Valider le paiement</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

// ---- RELANCES ----

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} role="switch" aria-checked={on} style={{ width: 46, height: 26, borderRadius: 999, border: 0, cursor: "pointer", background: on ? "var(--olive)" : "var(--line)", position: "relative", flexShrink: 0, transition: "background var(--dur-short) var(--ease-standard)" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: on ? "var(--paper)" : "var(--surface-card)", transition: "left var(--dur-short) var(--ease-standard)" }} />
    </button>
  )
}

function Relances({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const canalLabel = state.relCanal === "whatsapp" ? "WhatsApp" : "SMS"
  return (
    <main style={mainWrap}>
      <ViewHeader title="Relances" subtitle="Ranti relance vos locataires à votre place" />
      <section style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", boxShadow: "var(--shadow-cta)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-0.01em", color: "var(--ink-title)" }}>Relance automatique</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-muted)" }}>{state.relanceActive ? `Ranti relance par ${canalLabel} le jour de l'échéance.` : "Désactivée, vous relancez à la main."}</p>
          </div>
          <Toggle on={state.relanceActive} onClick={() => dispatch({ type: "toggle-relance" })} />
        </div>
        {state.relanceActive && (
          <div style={{ borderTop: "1px solid var(--line-soft)", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>Canal</span>
              <div style={{ display: "flex", gap: 10 }}>
                {(["whatsapp", "sms"] as const).map((c) => {
                  const active = state.relCanal === c
                  return <button key={c} type="button" onClick={() => dispatch({ type: "pick-canal", canal: c })} style={{ flex: 1, padding: 11, borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 600, border: active ? "1.5px solid var(--olive)" : "1.5px solid var(--line)", background: active ? "var(--olive-wash)" : "var(--surface-card)", color: active ? "var(--olive-deep)" : "var(--ink-muted)" }}>{c === "whatsapp" ? "WhatsApp" : "SMS"}</button>
                })}
              </div>
            </div>
            <div style={{ border: "1px solid var(--line-soft)", background: "var(--muted-surface)", borderRadius: "var(--radius-md)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-muted)" }}>Aperçu {canalLabel}</span>
              <span style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--ink)" }}>Bonjour, votre loyer arrive à échéance. Merci de régler dès que possible. Florentine (via Ranti)</span>
            </div>
          </div>
        )}
      </section>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={sectionTitle}>À relancer</h2>
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", padding: "clamp(22px,4vw,28px) 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: "var(--olive-wash)", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckIcon stroke="var(--olive-deep)" size={20} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem", color: "var(--ink-title)" }}>Aucun loyer en retard.</span>
          <span style={{ fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Rien à relancer pour l&apos;instant. Ranti veille et vous préviendra.</span>
        </div>
      </div>
    </main>
  )
}

// ---- BAUX ----

function Baux({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const rows = allRows(state)
  if (rows.length === 0) {
    return (
      <main style={mainWrap}>
        <ViewHeader title="Baux" subtitle="Tous vos logements suivis" />
        <EmptyLease title="Aucun bail enregistré." body="Enregistrez un logement et son occupant pour démarrer le suivi des loyers." cta="Créer un bail" onCta={() => dispatch({ type: "open-tenant-form", mode: "first" })} />
      </main>
    )
  }
  const label = (s: Row["status"]) => s === "paid" ? "À jour" : s === "late" ? "Retard" : "Attendu"
  const dot = (s: Row["status"]) => s === "paid" ? "var(--olive)" : s === "late" ? "var(--warning)" : "var(--ink-muted)"
  const badgeBg = (s: Row["status"]) => s === "paid" ? "var(--olive-wash)" : s === "late" ? "var(--warning-wash)" : "var(--muted-surface)"
  const badgeFg = (s: Row["status"]) => s === "paid" ? "var(--olive-deep)" : s === "late" ? "var(--warning)" : "var(--ink-muted)"
  return (
    <main style={mainWrap}>
      <ViewHeader title="Baux" subtitle="Tous vos logements suivis" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={sectionTitle}>{rows.length} bail suivi</h2>
          <button type="button" onClick={() => dispatch({ type: "open-tenant-form", mode: "tenant" })} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-full)", padding: "9px 16px", cursor: "pointer" }}>+ Locataire</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: dot(r.status) }} />
              <span style={{ minWidth: 120, flex: 1 }}><span style={{ display: "block", fontSize: "1.05rem", fontWeight: 500, color: "var(--ink)" }}>{r.name}</span><span style={{ display: "block", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{r.home} · {r.amount}</span></span>
              <span style={{ flexShrink: 0, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: badgeBg(r.status), color: badgeFg(r.status) }}>{label(r.status)}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// ---- PARAMETRES ----

function Parametres({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const line = (label: string, value: string) => (
    <div style={{ padding: "15px 22px", display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid var(--line-soft)" }}><span style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>{label}</span><span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--ink)" }}>{value}</span></div>
  )
  return (
    <main style={{ ...mainWrap, gap: "clamp(18px,2.5vw,24px)" }}>
      <ViewHeader title="Paramètres" subtitle="Votre compte et vos préférences" />
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem" }}>FD</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem", color: "var(--ink-title)" }}>{SEED.bailleur}</span>
          <span style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>Propriétaire · Cotonou</span>
        </div>
      </div>
      <section style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line-soft)" }}><h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem", color: "var(--ink-title)" }}>Relances</h2></div>
        <div style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><span style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--ink)" }}>Relances automatiques</span><span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Ranti relance seul les loyers en retard</span></div>
          <Toggle on={state.relanceActive} onClick={() => dispatch({ type: "toggle-relance" })} />
        </div>
      </section>
      <section style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line-soft)" }}><h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem", color: "var(--ink-title)" }}>Compte</h2></div>
        {line("Langue", "Français")}
        {line("Devise", "Franc CFA (FCFA)")}
        <div style={{ padding: "15px 22px", display: "flex", justifyContent: "space-between", gap: 16 }}><span style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>Offre</span><span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--ink)" }}>Ranti Essentiel</span></div>
      </section>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => dispatch({ type: "restart" })} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-full)", padding: "11px 20px", cursor: "pointer" }}>Rejouer la prise en main</button>
      </div>
    </main>
  )
}

export function MainContent({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  switch (state.view) {
    case "encaissements": return <Encaissements state={state} dispatch={dispatch} />
    case "relances": return <Relances state={state} dispatch={dispatch} />
    case "baux": return <Baux state={state} dispatch={dispatch} />
    case "parametres": return <Parametres state={state} dispatch={dispatch} />
    default: return <Accueil state={state} dispatch={dispatch} />
  }
}
