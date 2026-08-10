import { renderToBuffer } from "@react-pdf/renderer"
import { requireLandlordProfile } from "@/lib/landlords"
import { getOwnerStatement, resolveMonth } from "@/lib/statements"
import { OwnerStatementPdf } from "@/lib/statements/pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Relevé de gestion en PDF, même montage que la quittance
// (app/(app)/receipts/[id]/pdf) : rendu Node, aucun cache, pièce jointe.
// La RPC owner_statement est security_invoker : la RLS de l'agence connectée
// est la seule frontière — un mandant d'une autre agence renvoie 404.

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mandant"
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ownerId: string }> },
) {
  await requireLandlordProfile()
  const { ownerId } = await params
  const month = resolveMonth(new URL(request.url).searchParams.get("mois") ?? undefined)

  const statement = await getOwnerStatement(ownerId, month)
  if (!statement) {
    return new Response("Relevé introuvable.", { status: 404 })
  }

  const buffer = await renderToBuffer(OwnerStatementPdf({ statement }))
  const filename = `releve-${slugify(statement.owner.display_name)}-${month}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
