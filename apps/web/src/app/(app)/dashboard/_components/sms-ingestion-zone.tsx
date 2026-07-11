"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import type { SmsCollectionResponse } from "@/lib/sms"
import { recordSmsCollection } from "@/lib/collections/actions"
import {
  ValidationBottomSheet,
  type AnchoredContact,
  type CollectionDraft,
  type CompleteResult,
} from "./validation-bottom-sheet"

// Zone de collage SMS Mobile Money (ADR-014), sœur de <VoiceCapture />.
// Le propriétaire colle le SMS brut de l'opérateur → POST /api/sms/collection
// (Gemini + portefeuille) → carte de validation en tiroir bas → persistance par
// le pipeline record_collection existant. Aucun chemin d'écriture parallèle.

type Status = "idle" | "loading" | "error" | "unresolved"

export function SmsIngestionZone(): React.JSX.Element {
  const router = useRouter()
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState("")
  const [response, setResponse] = useState<SmsCollectionResponse | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notice, setNotice] = useState("")

  // Analyse le SMS collé. Déclenché au collage (onPaste) et à la soumission
  // manuelle. Ouvre le tiroir seulement si un bail a été résolu.
  const analyze = useCallback(async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setStatus("loading")
    setError("")
    setNotice("")
    try {
      const res = await fetch("/api/sms/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!res.ok) {
        setError("Lecture du SMS impossible. Saisissez l'encaissement manuellement.")
        setStatus("error")
        return
      }
      const data = (await res.json()) as SmsCollectionResponse
      setResponse(data)
      if (data.match) {
        setSheetOpen(true)
        setStatus("idle")
      } else {
        // Bail non reconnu : pas de tiroir, on oriente vers la saisie manuelle.
        setStatus("unresolved")
      }
    } catch {
      setError("Réseau indisponible. Saisissez l'encaissement manuellement.")
      setStatus("error")
    }
  }, [])

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData("text")
      if (pasted.trim()) {
        // Laisse le collage peupler le champ, puis analyse la valeur collée.
        setText(pasted)
        void analyze(pasted)
      }
    },
    [analyze],
  )

  // Persistance finale, déclenchée par la carte de validation.
  const onComplete = useCallback(
    async ({
      draft,
      contact,
    }: {
      draft: CollectionDraft
      contact: AnchoredContact | null
    }): Promise<CompleteResult> => {
      if (!response?.match) return { ok: false, message: "Bail introuvable." }

      const result = await recordSmsCollection({
        leaseId: response.match.lease_id,
        amount: draft.amount,
        reference: draft.transactionRef,
        senderName: draft.senderName,
        contactPhone: contact?.phone ?? null,
      })

      if (!result.ok) {
        // On NE ferme PAS le tiroir : on renvoie le message pour qu'il s'affiche
        // dans la carte. Le doublon (index unique) porte la référence.
        if (result.reason === "duplicate") {
          const ref = draft.transactionRef.trim()
          return {
            ok: false,
            message: ref
              ? `Ce paiement (Réf : ${ref}) a déjà été enregistré dans le journal.`
              : "Ce paiement a déjà été enregistré dans le journal.",
          }
        }
        return { ok: false, message: result.message }
      }

      // Succès : ferme, vide le champ, rafraîchit le journal (vue journal_feed).
      setSheetOpen(false)
      setResponse(null)
      setText("")
      setStatus("idle")
      setNotice("Encaissement enregistré.")
      router.refresh()
      return { ok: true }
    },
    [response, router],
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <label htmlFor="sms-paste" className="block text-sm font-medium text-foreground">
        Coller un SMS de paiement
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Collez le message reçu de Wave, Orange Money, MTN ou Moov.
      </p>

      <textarea
        id="sms-paste"
        rows={3}
        value={text}
        onPaste={onPaste}
        onChange={(e) => setText(e.target.value)}
        placeholder="Vous avez reçu 60 000 FCFA de…"
        disabled={status === "loading"}
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground disabled:opacity-60"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {status === "loading" ? "Lecture du SMS…" : notice}
        </span>
        <button
          type="button"
          onClick={() => void analyze(text)}
          disabled={status === "loading" || !text.trim()}
          className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-foreground disabled:opacity-40"
        >
          Analyser
        </button>
      </div>

      {status === "error" ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
            {error}
          </p>
          <Link
            href="/collections/new"
            className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Saisir manuellement
          </Link>
        </div>
      ) : null}

      {status === "unresolved" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Bail non reconnu
            {response?.tenant_hint ? ` (« ${response.tenant_hint} » ?)` : ""}. Choisissez-le à la main.
          </p>
          <Link
            href="/collections/new"
            className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Choisir le bail
          </Link>
        </div>
      ) : null}

      {response?.match ? (
        <ValidationBottomSheet
          open={sheetOpen}
          draft={{
            amount: response.match.amount || response.amount,
            senderName: response.sender_name,
            transactionRef: response.transaction_ref,
          }}
          lease={{ tenantName: response.match.tenant_name, unitName: response.match.unit_name }}
          duplicate={response.duplicate}
          onClose={() => setSheetOpen(false)}
          onComplete={onComplete}
        />
      ) : null}
    </div>
  )
}
