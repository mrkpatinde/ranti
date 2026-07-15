"use client"

import Link from "next/link"
import { Mic, Square } from "lucide-react"
import { useCallback, useRef, useState, useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}
function readSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined"
  )
}
import type { VoiceCollectionResponse } from "@/lib/voice"

type Status = "idle" | "recording" | "processing" | "result" | "error"

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

// Encode un AudioBuffer en WAV mono 16-bit PCM. Gemini accepte le WAV, pas le
// webm/opus produit par MediaRecorder — d'où cette conversion côté client.
function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const sampleRate = buffer.sampleRate
  const channels = buffer.numberOfChannels
  const length = buffer.length

  // Downmix mono.
  const mono = new Float32Array(length)
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels
  }

  const bytesPerSample = 2
  const out = new ArrayBuffer(44 + length * bytesPerSample)
  const view = new DataView(out)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, "RIFF")
  view.setUint32(4, 36 + length * bytesPerSample, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true) // taille sous-chunk fmt
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true) // bits par échantillon
  writeStr(36, "data")
  view.setUint32(40, length * bytesPerSample, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += bytesPerSample
  }

  return out
}

// Décode un blob audio (webm/opus), le rééchantillonne en 16 kHz mono, puis
// l'encode en WAV pour Gemini. 16 kHz suffit pour la parole et divise ~3× la
// taille → upload + traitement Gemini nettement plus rapides.
const TARGET_SAMPLE_RATE = 16000

async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer()
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer)
  } finally {
    void ctx.close()
  }

  const length = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE)
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const resampled = await offline.startRendering()

  return new Blob([encodeWav(resampled)], { type: "audio/wav" })
}

// Lit un Blob audio en base64 nu (sans le préfixe data:...;base64,).
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("read_failed"))
    reader.readAsDataURL(blob)
  })
}

export function VoiceCapture() {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string>("")
  const [result, setResult] = useState<VoiceCollectionResponse | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Support détecté côté client uniquement (serveur = false), hydration-safe :
  // évite le mismatch SSR/client sans setState dans un effet.
  const supported = useSyncExternalStore(noopSubscribe, readSupport, () => false)

  const send = useCallback(async (blob: Blob, mimeType: string) => {
    setStatus("processing")
    try {
      const audio = await blobToBase64(blob)
      const res = await fetch("/api/voice/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio, mimeType }),
      })
      if (!res.ok) {
        setError("La reconnaissance vocale n'a pas abouti. Utilisez la saisie manuelle.")
        setStatus("error")
        return
      }
      const data = (await res.json()) as VoiceCollectionResponse
      setResult(data)
      setStatus("result")
    } catch {
      setError("Réseau indisponible. Utilisez la saisie manuelle.")
      setStatus("error")
    }
  }, [])

  const start = useCallback(async () => {
    setError("")
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = recorder.mimeType || "audio/webm"
        const raw = new Blob(chunksRef.current, { type })
        try {
          const wav = await blobToWav(raw)
          void send(wav, "audio/wav")
        } catch {
          // Conversion impossible : on tente l'audio brut en dernier recours.
          void send(raw, type.split(";")[0])
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setStatus("recording")
    } catch {
      setError("Micro indisponible ou refusé. Utilisez la saisie manuelle.")
      setStatus("error")
    }
  }, [send])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
  }, [])

  const reset = useCallback(() => {
    setStatus("idle")
    setError("")
    setResult(null)
  }, [])

  if (!supported) {
    // Fallback définitif (Safari iOS restreint, WebView) : pas de vocal.
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight">Déclarer à la voix</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            « Koffi a payé son loyer de juillet » — Ranti remplit la fiche, vous validez.
          </p>
        </div>

        {status === "idle" || status === "error" ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:brightness-95"
          >
            <Mic size={16} strokeWidth={1.8} />
            Parler
          </button>
        ) : null}

        {status === "recording" ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex shrink-0 animate-pulse items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
          >
            <Square size={15} strokeWidth={2} fill="currentColor" />
            Terminer
          </button>
        ) : null}

        {status === "processing" ? (
          <span className="shrink-0 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-muted-foreground">
            Analyse…
          </span>
        ) : null}
      </div>

      {status === "error" ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
          <Link href="/collections/new" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Saisir manuellement
          </Link>
        </div>
      ) : null}

      {status === "result" && result ? (
        <div className="mt-4 space-y-4">
          {result.transcript ? (
            <p className="text-sm italic text-muted-foreground">« {result.transcript} »</p>
          ) : null}

          {result.match ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="font-semibold">
                  {result.match.tenant_name} — {result.match.unit_name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.match.amount > 0 ? `${formatAmount(result.match.amount)} entendu · ` : ""}
                  loyer {formatAmount(result.match.monthly_rent)}
                  {result.match.period ? ` · ${result.match.period}` : ""}
                </p>
                {result.match.confidence !== "high" ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    À vérifier — Ranti n&rsquo;est pas totalement sûr. Relisez avant de confirmer.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/collections/new?lease_id=${result.match.lease_id}${
                    result.match.amount > 0 ? `&amount=${result.match.amount}` : ""
                  }`}
                  className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
                >
                  Valider l&rsquo;encaissement
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition hover:border-primary"
                >
                  Recommencer
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Ranti n&rsquo;a pas reconnu le bail
                {result.tenant_hint ? ` (« ${result.tenant_hint} » ?)` : ""}. Choisissez-le à la main.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/collections/new"
                  className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
                >
                  Choisir le bail
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition hover:border-primary"
                >
                  Recommencer
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Séparateur « ou » vers la seconde modalité (collage SMS). Porté par le
          bloc vocal : si le micro n'est pas supporté, ce composant renvoie null
          et aucun « ou » orphelin ne s'affiche au-dessus du collage. */}
      <div className="my-5 flex items-center gap-3 text-xs font-medium text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
