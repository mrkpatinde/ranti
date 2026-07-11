import type { VoicePortfolioLease } from "@/lib/voice"
import type { SmsExtraction } from "./types"

// Appel Gemini en Structured Outputs sur le TEXTE d'un SMS Mobile Money.
// Serveur uniquement : la clé (process.env.GEMINI_API_KEY) ne doit jamais
// atteindre le client (comme ADR-012). Même transport que le vocal : fetch brut
// vers l'API generativelanguage, PAS le SDK @google/generative-ai.

const MODEL = "gemini-flash-lite-latest"
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

// Schéma de sortie forcé. Gemini renvoie strictement ce JSON.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    amount: { type: "integer" },
    sender_name: { type: "string" },
    transaction_ref: { type: "string" },
    lease_id: { type: "string" },
    period: { type: "string" },
    tenant_hint: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "amount",
    "sender_name",
    "transaction_ref",
    "lease_id",
    "period",
    "tenant_hint",
    "confidence",
  ],
} as const

function buildPrompt(portfolio: VoicePortfolioLease[], ownerAlias: string | null): string {
  const leaseLines = portfolio
    .map(
      (l) =>
        `- lease_id="${l.lease_id}" | locataire="${l.tenant_name}" | logement="${l.unit_name}" | loyer=${l.monthly_rent} FCFA`
    )
    .join("\n")

  return [
    "Tu assistes un propriétaire ouest-africain qui colle le SMS de confirmation",
    "d'un paiement Mobile Money reçu (Wave, Orange Money, MTN MoMo, Moov Money).",
    "Extrais les faits du SMS, puis résous-le vers UN bail de la liste ci-dessous.",
    "",
    ownerAlias
      ? `Numéro/alias du propriétaire (le DESTINATAIRE, jamais l'émetteur) : ${ownerAlias}`
      : "Alias du propriétaire inconnu.",
    "",
    "Baux actifs du propriétaire :",
    leaseLines || "(aucun bail actif)",
    "",
    "Formats fréquents :",
    '- Wave : "Vous avez recu 60000 CFA de Koffi ADANDE. ... ID: TXXXXXXX".',
    '- Orange Money : "Vous avez recu 60000 FCFA de 22997xxxxxx ... Ref: OMxxxxx".',
    '- MTN MoMo : "You have received 60,000 XOF from JEAN K. ... Txn ID: xxxxx".',
    '- Moov Money : "Transfert recu de ... Montant 60000 ... Reference xxxxx".',
    "",
    "Règles :",
    '- "amount" = montant RECU en FCFA (entier, sans séparateur). 0 si absent.',
    '- "sender_name" = nom de l\'ÉMETTEUR (celui qui a payé). "" si le SMS ne',
    "  donne qu'un numéro ou rien. Ne confonds jamais émetteur et destinataire.",
    '- "transaction_ref" = identifiant d\'opération (ID/Ref/Txn ID). "" si absent.',
    '- "lease_id" DOIT être exactement l\'un des lease_id listés (résolu via le',
    "  nom de l'émetteur, le montant, le logement). Si aucun ne correspond avec",
    '  certitude, renvoie lease_id="".',
    '- "period" = mois évoqué en clair si présent, sinon "".',
    '- "tenant_hint" = nom du locataire déduit, même si non résolu.',
    '- "confidence" = high si émetteur + montant concordent avec un bail,',
    "  medium si un doute, low sinon.",
  ].join("\n")
}

export async function extractCollectionFromSms(params: {
  text: string
  portfolio: VoicePortfolioLease[]
  ownerAlias: string | null
}): Promise<SmsExtraction | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(params.portfolio, params.ownerAlias) },
          { text: `SMS collé :\n"""\n${params.text}\n"""` },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      // Extraction simple : pas de raisonnement long (sinon timeout, cf. vocal).
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
    console.error("[sms] Gemini injoignable", (err as Error)?.name)
    return null
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[sms] Gemini non-ok", res.status, detail.slice(0, 500))
    return null
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null

  try {
    return JSON.parse(text) as SmsExtraction
  } catch {
    return null
  }
}
