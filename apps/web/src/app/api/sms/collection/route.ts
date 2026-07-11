import { NextResponse } from "next/server"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { getVoicePortfolio } from "@/lib/voice"
import { extractCollectionFromSms } from "@/lib/sms"
import type { SmsCollectionResponse } from "@/lib/sms"

// POST /api/sms/collection
// Reçoit le texte brut d'un SMS Mobile Money collé par le propriétaire, le
// résout vers un bail actif via Gemini + le portefeuille, et renvoie une carte
// de validation. N'écrit JAMAIS en base (jumeau ADR-012) : l'écriture se fait
// dans /collections/new, où l'index unique partiel (landlord_id,
// payment_reference) garantit la déduplication au niveau DB.

const MAX_TEXT_LEN = 2000 // un SMS d'opérateur, large garde-fou

export async function POST(request: Request): Promise<NextResponse> {
  const landlord = await requireLandlordProfile()

  let payload: { text?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : ""
  if (!text) {
    return NextResponse.json({ error: "invalid_text" }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json({ error: "text_too_large" }, { status: 413 })
  }

  const portfolio = await getVoicePortfolio(landlord.id)

  const extraction = await extractCollectionFromSms({
    text,
    portfolio,
    ownerAlias: landlord.payment_alias ?? null,
  })

  if (!extraction) {
    // Clé absente ou échec Gemini : le client bascule en saisie manuelle.
    return NextResponse.json({ error: "extraction_failed" }, { status: 502 })
  }

  // Ne jamais faire confiance au lease_id du modèle : re-valider contre le
  // portefeuille réel du propriétaire.
  const lease = portfolio.find((l) => l.lease_id === extraction.lease_id)

  // Pré-contrôle de doublon : si la référence a déjà été encaissée, on prévient
  // le client avant même la carte (la RLS filtre déjà sur le propriétaire).
  let duplicate = false
  const transactionRef = extraction.transaction_ref?.trim() ?? ""
  if (transactionRef) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("rent_receptions")
      .select("id")
      .eq("payment_reference", transactionRef)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle()
    duplicate = Boolean(data)
  }

  const amount = Number.isInteger(extraction.amount) && extraction.amount > 0 ? extraction.amount : 0

  const response: SmsCollectionResponse = {
    amount,
    sender_name: extraction.sender_name ?? "",
    transaction_ref: transactionRef,
    match: lease
      ? {
          lease_id: lease.lease_id,
          tenant_name: lease.tenant_name,
          unit_name: lease.unit_name,
          monthly_rent: lease.monthly_rent,
          amount,
          period: extraction.period ?? "",
          confidence: extraction.confidence,
        }
      : null,
    tenant_hint: extraction.tenant_hint ?? "",
    duplicate,
  }

  return NextResponse.json(response)
}
