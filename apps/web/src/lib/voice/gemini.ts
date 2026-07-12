import type { VoiceExtraction, VoicePortfolioLease } from "./types"

// Appel Gemini 2.5 Flash en Structured Outputs. Serveur uniquement : la clé
// (process.env.GEMINI_API_KEY) ne doit jamais atteindre le client (ADR-012).

// flash-lite : latence ~1 s sur audio court (le flash standard mettait
// 30-60 s sur cette clé et partait en timeout). Suffisant pour l'extraction.
const MODEL = "gemini-flash-lite-latest"
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

// Schéma de sortie forcé. Gemini renvoie strictement ce JSON.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    lease_id: { type: "string" },
    amount: { type: "integer" },
    period: { type: "string" },
    tenant_hint: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    transcript: { type: "string" },
  },
  required: ["lease_id", "amount", "period", "tenant_hint", "confidence", "transcript"],
} as const

function buildPrompt(portfolio: VoicePortfolioLease[]): string {
  const leaseLines = portfolio
    .map(
      (l) =>
        `- lease_id="${l.lease_id}" | locataire="${l.tenant_name}" | logement="${l.unit_name}" | loyer=${l.monthly_rent} FCFA`
    )
    .join("\n")

  return [
    "Tu assistes un propriétaire béninois qui déclare à la voix un loyer reçu.",
    "Il parle français, souvent en langage familier, avec des noms locaux.",
    "Transcris l'audio, puis résous-le vers UN bail de la liste ci-dessous.",
    "",
    "Baux actifs du propriétaire :",
    leaseLines || "(aucun bail actif)",
    "",
    "Règles :",
    '- "lease_id" DOIT être exactement l\'un des lease_id listés. Si aucun ne',
    '  correspond avec certitude, renvoie lease_id="".',
    "- Ne devine JAMAIS : si le nom prononcé ne correspond à aucun locataire de",
    '  la liste, renvoie lease_id="" — même s\'il n\'existe qu\'un seul bail.',
    '- "amount" = montant en FCFA entendu (entier). 0 si non dit. "60k" = 60000.',
    '- "period" = mois évoqué en clair ("juillet", "2026-07") ou "" si absent.',
    '- "tenant_hint" = le nom de locataire entendu, même si non résolu.',
    '- "confidence" = high si nom + intention clairs, medium si un doute, low sinon.',
    '- "transcript" = transcription fidèle de ce que tu as entendu.',
  ].join("\n")
}

export async function extractCollectionFromAudio(params: {
  audioBase64: string
  mimeType: string
  portfolio: VoicePortfolioLease[]
}): Promise<VoiceExtraction | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(params.portfolio) },
          { inlineData: { mimeType: params.mimeType, data: params.audioBase64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      // Extraction simple : pas de raisonnement long. Sans ça, le modèle
      // "réfléchit" 30-60 s et la requête part en timeout.
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    console.error("[voice] Gemini injoignable", (err as Error)?.name)
    return null
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[voice] Gemini non-ok", res.status, detail.slice(0, 500))
    return null
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null

  try {
    const parsed = JSON.parse(text) as VoiceExtraction
    return parsed
  } catch {
    return null
  }
}
