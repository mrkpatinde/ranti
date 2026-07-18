import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"
import { createClient } from "@/lib/supabase/server"
import { ReceiptPdf } from "@/lib/receipts/pdf"
import type { Landlord } from "@/lib/landlords"
import type { Receipt, ReceiptByToken } from "@/lib/receipts/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PDF public du reçu partagé, par token (ADR-013). Même frontière de confiance
// que la page /recu/[token] : les données viennent de la RPC SECURITY DEFINER
// get_receipt_by_token (l'anon ne lit aucune table), le token UUID EST la
// capacité d'accès. Aucun service-role ici.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!UUID_RE.test(token)) {
    return new Response("Reçu introuvable.", { status: 404 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_receipt_by_token", { p_token: token })
  const row = (data as ReceiptByToken[] | null)?.[0]
  if (error || !row) {
    return new Response("Reçu introuvable.", { status: 404 })
  }

  // Reconstruit les formes attendues par ReceiptPdf à partir de la vue token.
  const receipt: Receipt = {
    id: "",
    landlord_id: "",
    rent_reception_id: "",
    receipt_number: row.receipt_number,
    issued_at: row.issued_at,
    total_amount: row.total_amount,
    currency: row.currency,
    status: row.status,
    kind: row.kind,
    pdf_storage_path: null,
    cancelled_at: null,
    cancellation_reason: null,
    snapshot: {
      tenant: {
        first_name: row.tenant_first_name ?? "",
        last_name: row.tenant_last_name ?? "",
        phone: null,
      },
      unit: row.unit_name ? { name: row.unit_name, type: "" } : undefined,
      allocations: row.allocations,
    },
    tenant_ack: row.tenant_ack,
    tenant_token: token,
    tenant_read_at: row.tenant_read_at,
    tenant_certified_at: row.tenant_certified_at,
    contested_at: row.contested_at,
    contest_nature: row.contest_nature,
    contested_amount: row.contested_amount,
    contested_period: row.contested_period,
    sha256_fingerprint: row.sha256_fingerprint,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  }

  const landlord: Landlord = {
    id: "",
    auth_user_id: "",
    phone: "",
    first_name: row.landlord_first_name ?? "",
    last_name: row.landlord_last_name ?? "",
    civility: null,
    payment_alias: null,
    payment_alias_type: null,
    onboarding_status: "done",
    reminders_enabled: false,
    reminder_channel: null,
    reminder_moment: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  }

  // QR = lien de vérification publique (la page partagée elle-même).
  const shareUrl = `${new URL(request.url).origin}/recu/${token}`
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 0, width: 240 })
  } catch {
    qrDataUrl = null
  }

  const buffer = await renderToBuffer(ReceiptPdf({ receipt, landlord, qrDataUrl }))
  const filename = `${row.kind === "quittance" ? "quittance" : "recu"}-${row.receipt_number}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
