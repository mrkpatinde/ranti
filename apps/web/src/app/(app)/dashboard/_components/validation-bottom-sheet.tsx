"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Carte de validation du collage SMS Mobile Money (ADR-014), en tiroir bas.
// Composant purement présentiel : il n'écrit rien en base. Il émet un brouillon
// (+ contact optionnel) au parent via onComplete ; le parent persiste par le
// pipeline existant record_collection → confirm_collection → generate_receipt.
//
// Design monochrome volontaire (anthracite / blanc cassé), distinct de l'accent
// olive du reste de l'app — arbitrage /design-consultation, pas cet écran.

// ── Contrat ────────────────────────────────────────────────────────────────

export interface CollectionDraft {
  /** Montant reçu en FCFA (entier, sans décimale). */
  amount: number
  /** Nom de l'émetteur lu dans le SMS, chaîne vide si inconnu. */
  senderName: string
  /** Référence d'opération de l'opérateur, chaîne vide si absente. */
  transactionRef: string
}

export interface AnchoredContact {
  name: string
  phone: string
}

export interface ValidationBottomSheetProps {
  /** Ouverture contrôlée par le parent. */
  open: boolean
  /** Valeurs extraites par Gemini, servent de point de départ éditable. */
  draft: CollectionDraft
  /** Bail résolu côté serveur, pour l'en-tête (facultatif). */
  lease?: { tenantName: string; unitName: string } | null
  /** true si la référence a déjà été encaissée (SMS collé deux fois). */
  duplicate?: boolean
  /** Fermeture (glissement bas, barre de préhension, Échap, overlay). */
  onClose: () => void
  /**
   * Validation finale : brouillon corrigé + contact ancré (ou null si l'étape
   * a été passée / non supportée). Le parent persiste puis referme le tiroir.
   */
  /**
   * Validation finale. Renvoie le résultat pour que le tiroir reste ouvert et
   * affiche l'erreur en cas d'échec (ex. doublon), au lieu de se fermer.
   * En cas de succès, le parent referme le tiroir (open=false).
   */
  onComplete: (result: {
    draft: CollectionDraft
    contact: AnchoredContact | null
  }) => Promise<CompleteResult>
}

export type CompleteResult = { ok: true } | { ok: false; message: string }

// ── Contact Picker API (non typée dans lib.dom) ──────────────────────────────

interface ContactInfo {
  name?: string[]
  tel?: string[]
}
interface ContactsManager {
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<ContactInfo[]>
}
type NavigatorWithContacts = Navigator & { contacts?: ContactsManager }

function contactPickerSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    "contacts" in navigator &&
    "ContactsManager" in window
  )
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

const DRAG_CLOSE_THRESHOLD = 120 // px de glissement vers le bas pour fermer
const ANIM_MS = 300

type Phase = "review" | "anchor" | "manual"
type EditableField = "amount" | "senderName" | "transactionRef" | null

// ── Composant ────────────────────────────────────────────────────────────────

export function ValidationBottomSheet({
  open,
  draft,
  lease = null,
  duplicate = false,
  onClose,
  onComplete,
}: ValidationBottomSheetProps): React.JSX.Element | null {
  const [rendered, setRendered] = useState(open)
  const [entered, setEntered] = useState(false)
  const [phase, setPhase] = useState<Phase>("review")
  const [editing, setEditing] = useState<EditableField>(null)
  const [values, setValues] = useState<CollectionDraft>(draft)
  const [manualPhone, setManualPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const dragStartRef = useRef<number | null>(null)

  // Transition d'ouverture/fermeture pilotée en phase de rendu (pattern
  // recommandé plutôt qu'un setState synchrone dans un effet) : au passage
  // open false→true on monte + réinitialise ; true→false on lance la sortie.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setRendered(true)
      setValues(draft)
      setPhase("review")
      setEditing(null)
      setManualPhone("")
      setDragY(0)
      setSubmitting(false)
      setSubmitError("")
      setEntered(false)
    } else {
      setEntered(false)
    }
  }

  // Montée : à la frame suivant le montage, bascule entered → joue le glissement.
  useEffect(() => {
    if (!open || !rendered) return
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [open, rendered])

  // Descente : démonte après la transition de sortie.
  useEffect(() => {
    if (open || !rendered) return
    const t = setTimeout(() => setRendered(false), ANIM_MS)
    return () => clearTimeout(t)
  }, [open, rendered])

  // Échap ferme.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const requestClose = useCallback(() => {
    if (submitting) return
    onClose()
  }, [submitting, onClose])

  // ── Glissement (barre de préhension) ──────────────────────────────────────
  const onGripPointerDown = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = e.clientY
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onGripPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartRef.current === null) return
      const delta = e.clientY - dragStartRef.current
      setDragY(delta > 0 ? delta : 0) // uniquement vers le bas
    },
    [],
  )

  const onGripPointerUp = useCallback(() => {
    setDragging(false)
    if (dragStartRef.current === null) return
    dragStartRef.current = null
    if (dragY > DRAG_CLOSE_THRESHOLD) {
      onClose()
    } else {
      setDragY(0)
    }
  }, [dragY, onClose])

  // ── Édition inline d'une ligne ────────────────────────────────────────────
  const commitEdit = useCallback(() => setEditing(null), [])

  const updateField = useCallback(
    (field: Exclude<EditableField, null>, raw: string) => {
      setSubmitError("") // une correction efface l'erreur précédente
      setValues((v) => {
        if (field === "amount") {
          const digits = raw.replace(/[^\d]/g, "")
          return { ...v, amount: digits ? Number.parseInt(digits, 10) : 0 }
        }
        return { ...v, [field]: raw }
      })
    },
    [],
  )

  // ── Phase 2 : ancrage contact ─────────────────────────────────────────────
  // On garde le tiroir ouvert et on affiche l'erreur si onComplete échoue (ex.
  // doublon) ; en cas de succès le parent referme via open=false, donc on laisse
  // submitting actif jusqu'au démontage.
  const finish = useCallback(
    async (contact: AnchoredContact | null) => {
      setSubmitting(true)
      setSubmitError("")
      const result = await onComplete({ draft: values, contact })
      if (!result.ok) {
        setSubmitError(result.message)
        setSubmitting(false)
      }
    },
    [onComplete, values],
  )

  const pickFromDevice = useCallback(async () => {
    const nav = navigator as NavigatorWithContacts
    if (!nav.contacts) {
      setPhase("manual")
      return
    }
    try {
      const picked = await nav.contacts.select(["name", "tel"], { multiple: false })
      const first = picked[0]
      if (!first) return // annulé par l'utilisateur
      const name = first.name?.[0]?.trim() || values.senderName || "Contact"
      const phone = first.tel?.[0]?.trim() || ""
      await finish({ name, phone })
    } catch {
      // Refus de permission ou API indisponible : bascule saisie manuelle.
      setPhase("manual")
    }
  }, [finish, values.senderName])

  const confirmManualPhone = useCallback(async () => {
    const phone = manualPhone.trim()
    if (!phone) return
    await finish({ name: values.senderName || "Contact", phone })
  }, [manualPhone, finish, values.senderName])

  if (!rendered) return null

  const dragActive = dragging || dragY > 0
  const sheetTransform = dragActive ? { transform: `translateY(${dragY}px)` } : undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      aria-hidden={!open}
    >
      {/* Overlay flou */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Tiroir */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Valider l'encaissement"
        style={sheetTransform}
        className={[
          "relative w-full max-w-md rounded-t-3xl border-t border-border bg-background",
          "px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3",
          "shadow-[0_-16px_48px_-24px_rgba(0,0,0,0.5)]",
          dragActive ? "transition-none" : "transition-transform duration-300 ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        {/* Barre de préhension */}
        <div
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          className="mx-auto flex h-8 w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* En-tête bail (si résolu) */}
        {lease ? (
          <p className="mb-1 text-center text-sm font-medium text-muted-foreground">
            {lease.tenantName} · {lease.unitName}
          </p>
        ) : null}

        {duplicate ? (
          <p className="mb-3 rounded-xl border border-border bg-secondary px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
            Cette référence a déjà été encaissée. Vérifiez avant de confirmer.
          </p>
        ) : null}

        {/* Montant en grand */}
        <div className="pb-2 pt-1 text-center">
          {editing === "amount" ? (
            <input
              autoFocus
              inputMode="numeric"
              value={values.amount ? String(values.amount) : ""}
              onChange={(e) => updateField("amount", e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => e.key === "Enter" && commitEdit()}
              className="w-full bg-transparent text-center text-4xl font-semibold tracking-tight text-foreground outline-none"
              aria-label="Montant en FCFA"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("amount")}
              className="text-4xl font-semibold tracking-tight text-foreground transition-opacity hover:opacity-70"
            >
              {formatAmount(values.amount)}
            </button>
          )}
        </div>

        {/* Lignes détail éditables */}
        <dl className="divide-y divide-border border-y border-border">
          <EditableRow
            label="Expéditeur"
            field="senderName"
            value={values.senderName}
            placeholder="Inconnu"
            editing={editing === "senderName"}
            onEdit={() => setEditing("senderName")}
            onChange={(raw) => updateField("senderName", raw)}
            onCommit={commitEdit}
          />
          <EditableRow
            label="Référence"
            field="transactionRef"
            value={values.transactionRef}
            placeholder="N/A"
            editing={editing === "transactionRef"}
            onEdit={() => setEditing("transactionRef")}
            onChange={(raw) => updateField("transactionRef", raw)}
            onCommit={commitEdit}
          />
        </dl>

        {/* Erreur de persistance (ex. doublon) — monochrome, tiroir maintenu */}
        {submitError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-5 text-foreground"
          >
            {submitError}
          </p>
        ) : null}

        {/* Zone d'action, morphing review → anchor → manual */}
        <div className="pt-5">
          {phase === "review" ? (
            <button
              type="button"
              onClick={() => setPhase("anchor")}
              className="w-full rounded-2xl bg-foreground py-4 text-center text-base font-semibold text-background transition-transform duration-200 active:scale-[0.99]"
            >
              Confirmer l&rsquo;encaissement
            </button>
          ) : null}

          {phase === "anchor" ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => (contactPickerSupported() ? void pickFromDevice() : setPhase("manual"))}
              className="w-full rounded-2xl bg-foreground py-4 text-center text-base font-semibold text-background transition-transform duration-200 active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? "Enregistrement…" : "Associer à un contact"}
            </button>
          ) : null}

          {phase === "manual" ? (
            <div className="space-y-3">
              <input
                autoFocus
                inputMode="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="Numéro du locataire"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-center text-base text-foreground outline-none transition-colors focus:border-foreground"
                aria-label="Numéro du contact"
              />
              <button
                type="button"
                disabled={submitting || !manualPhone.trim()}
                onClick={() => void confirmManualPhone()}
                className="w-full rounded-2xl bg-foreground py-4 text-center text-base font-semibold text-background transition-transform duration-200 active:scale-[0.99] disabled:opacity-40"
              >
                {submitting ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Ligne détail éditable ────────────────────────────────────────────────────

function EditableRow(props: {
  label: string
  field: Exclude<EditableField, null>
  value: string
  placeholder: string
  editing: boolean
  onEdit: () => void
  onChange: (raw: string) => void
  onCommit: () => void
}): React.JSX.Element {
  const { label, value, placeholder, editing, onEdit, onChange, onCommit } = props
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-right">
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => e.key === "Enter" && onCommit()}
            placeholder={placeholder}
            className="w-full bg-transparent text-right text-sm font-medium text-foreground outline-none"
            aria-label={label}
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="max-w-full truncate text-sm font-medium text-foreground transition-opacity hover:opacity-60"
          >
            {value.trim() || <span className="text-muted-foreground">{placeholder}</span>}
          </button>
        )}
      </dd>
    </div>
  )
}
