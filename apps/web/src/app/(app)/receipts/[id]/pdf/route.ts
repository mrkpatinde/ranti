import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"
import { requireLandlordProfile } from "@/lib/landlords"
import { getReceipt } from "@/lib/receipts"
import { ReceiptPdf } from "@/lib/receipts/pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const landlord = await requireLandlordProfile()
  const { id } = await params

  const receipt = await getReceipt(landlord.id, id)
  if (!receipt) {
    return new Response("Document introuvable.", { status: 404 })
  }

  // QR encodes the verification URL for this document.
  const verifyUrl = `${new URL(request.url).origin}/verifier/${receipt.id}`
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 240 })
  } catch {
    qrDataUrl = null
  }

  const buffer = await renderToBuffer(
    ReceiptPdf({ receipt, landlord, qrDataUrl })
  )

  const filename = `${receipt.kind === "quittance" ? "quittance" : "recu"}-${receipt.receipt_number}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
