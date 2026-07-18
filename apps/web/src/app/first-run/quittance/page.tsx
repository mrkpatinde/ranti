"use client"

import { useState } from "react"
import "../first-run.css"
import { oliveCta, Wordmark, DefRow, CheckIcon } from "../shared"

// Portage fidele de QuittanceLocataire.dc.html : page publique mobile-first que
// le locataire ouvre via lien / QR (ranti.app/q/<ref>). Etats a-confirmer /
// confirmee, en local. Apercu statique HORS perimetre phase 3 : la vraie page
// locataire cablee a la base vit sur /recu/[token]. Constantes de demo locales
// (le parcours proprietaire, lui, est cable). Copy sans tiret cadratin.
const DEMO = {
  bailleur: "Florentine Dossou",
  locataire: "Adjovi Hounkpatin",
  logement: "Villa 3 ch, Fidjrossè",
  montant: "100 000 FCFA",
  ref: "RNT-2026-0148",
}

export default function QuittanceLocatairePage() {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className="fr-scope" style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(18px,4vw,44px) 16px clamp(32px,6vw,56px)" }}>
      <div style={{ width: 430, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Wordmark size={30} subtitle="Registre de loyer" />
          <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-muted)" }}>Lien vérifié</span>
        </header>

        {!confirmed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.5rem,6vw,1.8rem)", lineHeight: 1.08, letterSpacing: "-0.03em", color: "var(--ink-title)" }}>Bonjour Adjovi, votre quittance est prête.</h1>
            <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.55, color: "var(--ink-muted)" }}>Florentine Dossou a enregistré votre loyer de juillet. Vérifiez, puis confirmez la réception, c&apos;est gratuit et sans compte.</p>
          </div>
        )}

        {confirmed && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid var(--olive)", background: "var(--olive-wash)", borderRadius: "var(--radius-lg)", padding: "14px 16px", animation: "fr-rise var(--dur-medium) var(--ease-enter) both" }}>
            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: "var(--olive)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, animation: "fr-pop var(--dur-medium) var(--ease-enter) both" }}><CheckIcon size={15} /></span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--olive-deep)" }}>Quittance confirmée, merci Adjovi.</span>
              <span style={{ fontSize: "0.85rem", lineHeight: 1.45, color: "var(--ink)" }}>Votre confirmation du 17 juillet 2026 est enregistrée dans le registre. Gardez ce lien : il reste votre preuve.</span>
            </div>
          </div>
        )}

        <div style={{ background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-proof)", overflow: "hidden" }}>
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "-0.02em", color: "var(--ink-title)" }}>Quittance de loyer</h2>
                <span style={{ fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: "var(--ink-muted)" }}>N° {DEMO.ref} · 17 juillet 2026</span>
              </div>
              {confirmed ? (
                <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--olive)" }} />Confirmée</span>
              ) : (
                <span style={{ flexShrink: 0, fontSize: "0.78rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--muted-surface)", color: "var(--ink-muted)" }}>À confirmer</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DefRow label="Bailleur" value={DEMO.bailleur} />
              <DefRow label="Locataire" value={DEMO.locataire} />
              <DefRow label="Logement" value={DEMO.logement} />
              <DefRow label="Période réglée" value="Juillet 2026" />
              <DefRow label="Reçu le" value="16 juillet 2026" />
            </div>
            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>Montant réglé</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: "var(--ink-title)" }}>{DEMO.montant}</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Je soussignée Florentine Dossou, bailleur, reconnais avoir reçu la somme de <strong style={{ color: "var(--ink)", fontWeight: 600 }}>cent mille francs CFA</strong> au titre du loyer de juillet 2026, dont quittance pour solde de ladite période.</p>
            <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Intégrité du document, empreinte SHA-256 : <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: "0.72rem", color: "var(--ink)" }}>c7a19b4e…d80f42e0</span></p>
          </div>

          {!confirmed && (
            <div style={{ borderTop: "1px solid var(--line)", background: "var(--muted-surface)", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" onClick={() => setConfirmed(true)} style={{ ...oliveCta, fontSize: "1rem", padding: "15px 24px" }}>Confirmer la réception</button>
              <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.5, textAlign: "center", color: "var(--ink-muted)" }}>En confirmant, vous attestez que ce loyer a bien été réglé. Votre confirmation est ajoutée au registre.</p>
            </div>
          )}
          {confirmed && (
            <div style={{ borderTop: "1px solid var(--line)", background: "var(--muted-surface)", padding: "16px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" style={{ flex: 1, minWidth: 170, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: "0.92rem", fontWeight: 600, color: "var(--ink)", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-full)", padding: "12px 18px", cursor: "pointer" }}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Télécharger en PDF
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid var(--line-soft)", background: "var(--surface-card)", borderRadius: "var(--radius-lg)", padding: "13px 16px" }}>
          <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: "var(--olive-wash)", color: "var(--olive-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} aria-hidden="true"><path d="M6 3h12v18H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </span>
          <span style={{ fontSize: "0.85rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Un doute sur cette quittance ? Toutes les réponses sont dans le <strong style={{ color: "var(--ink)", fontWeight: 600 }}>centre d&apos;aide Ranti</strong>.</span>
        </div>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.78rem", lineHeight: 1.5, color: "var(--ink-muted)" }}>Document édité par Ranti pour Florentine Dossou · vérifiable sur ranti.app/q/{DEMO.ref}</p>
      </div>
    </div>
  )
}
