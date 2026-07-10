import { NextResponse } from "next/server"
import { requireLandlordProfile } from "@/lib/landlords"
import { extractCollectionFromAudio, getVoicePortfolio } from "@/lib/voice"
import type { VoiceCollectionResponse } from "@/lib/voice"

// POST /api/voice/collection
// Reçoit un court audio, le résout vers un bail actif via Gemini + le
// portefeuille du propriétaire, et renvoie une carte de validation.
// N'écrit JAMAIS en base (ADR-012) : l'écriture se fait dans /collections/new.

const MAX_AUDIO_BYTES = 5 * 1024 * 1024 // ~5 Mo, un push-to-talk court

export async function POST(request: Request): Promise<NextResponse> {
  const landlord = await requireLandlordProfile()

  let payload: { audio?: unknown; mimeType?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const audioBase64 = typeof payload.audio === "string" ? payload.audio : ""
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : ""

  if (!audioBase64 || !mimeType.startsWith("audio/")) {
    return NextResponse.json({ error: "invalid_audio" }, { status: 400 })
  }

  // Garde-fou taille (base64 ≈ 4/3 des octets bruts).
  if (audioBase64.length * 0.75 > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 })
  }

  const portfolio = await getVoicePortfolio(landlord.id)

  const extraction = await extractCollectionFromAudio({
    audioBase64,
    mimeType,
    portfolio,
  })

  if (!extraction) {
    // Clé absente ou échec Gemini : le client bascule en saisie manuelle.
    return NextResponse.json({ error: "extraction_failed" }, { status: 502 })
  }

  // Ne jamais faire confiance au lease_id du modèle : re-valider contre le
  // portefeuille réel du propriétaire.
  const lease = portfolio.find((l) => l.lease_id === extraction.lease_id)

  const response: VoiceCollectionResponse = lease
    ? {
        transcript: extraction.transcript,
        match: {
          lease_id: lease.lease_id,
          tenant_name: lease.tenant_name,
          unit_name: lease.unit_name,
          monthly_rent: lease.monthly_rent,
          amount: Number.isInteger(extraction.amount) && extraction.amount > 0 ? extraction.amount : 0,
          period: extraction.period ?? "",
          confidence: extraction.confidence,
        },
        tenant_hint: extraction.tenant_hint ?? "",
      }
    : {
        transcript: extraction.transcript,
        match: null,
        tenant_hint: extraction.tenant_hint ?? "",
      }

  return NextResponse.json(response)
}
