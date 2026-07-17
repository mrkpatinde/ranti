/**
 * Génère l'image de quittance de la landing (public/quittance-demo.png)
 * à partir du VRAI composant ReceiptPdf — même document que celui remis
 * aux locataires, avec des données de démonstration alignées sur
 * /verifier/demo (n° RNT-2026-DEMO, jamais émis en vrai).
 *
 * Garde-fous anti-contrefaçon (revue adversariale 2026-07-15) :
 * - filigrane « SPÉCIMEN — SANS VALEUR PROBANTE » cuit dans le PNG
 *   (le QR ne protège que ceux qui le scannent ; le filigrane protège
 *   le vérificateur hors-ligne) ;
 * - pas d'empreinte SHA-256 fabriquée (fingerprint null) ;
 * - numéro impossible RNT-2026-DEMO, identités abrégées, QR → /verifier/demo.
 *
 * Regénérer après tout changement de ReceiptPdf :
 *   cd apps/web && npx tsx scripts/generate-demo-quittance.tsx
 * (rasterisation via qlmanage — macOS uniquement ; recadrage + filigrane via sharp)
 */
process.env.TZ = "UTC" // dates du document stables quel que soit le fuseau de la machine

import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"
import sharp from "sharp"
import { ReceiptPdf } from "../src/lib/receipts/pdf"
import type { Landlord } from "@/lib/landlords"
import type { Receipt } from "../src/lib/receipts/types"

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT_PATH = path.join(APP_ROOT, "public", "quittance-demo.png")

// Mêmes identités abrégées que /verifier/demo : aucune identité complète
// inventée, le numéro DEMO ne peut correspondre à aucun vrai document.
const receipt: Receipt = {
  id: "demo",
  landlord_id: "demo",
  rent_reception_id: "demo",
  receipt_number: "RNT-2026-DEMO",
  issued_at: "2026-07-06",
  total_amount: 100_000,
  currency: "XOF",
  status: "issued",
  kind: "quittance",
  pdf_storage_path: null,
  cancelled_at: null,
  cancellation_reason: null,
  snapshot: {
    tenant: { first_name: "Adjovi", last_name: "H.", phone: null },
    unit: { name: "Villa 3 ch — Fidjrossè", type: "villa" },
    reception: {
      amount_received: 100_000,
      currency: "XOF",
      payment_method: "mobile_money",
      received_at: "2026-07-05",
    },
    allocations: [
      { period_start: "2026-07-01", period_end: "2026-07-31", amount_allocated: 100_000 },
    ],
  },
  tenant_ack: "certified",
  tenant_token: "demo",
  tenant_read_at: "2026-07-05",
  tenant_certified_at: "2026-07-06",
  contested_at: null,
  contest_nature: null,
  contested_amount: null,
  contested_period: null,
  // Jamais d'empreinte fabriquée sur le spécimen : une vraie quittance certifiée
  // en porte une, le spécimen n'atteste rien.
  sha256_fingerprint: null,
  created_at: "2026-07-05",
  updated_at: "2026-07-06",
  deleted_at: null,
}

const landlord: Landlord = {
  id: "demo",
  auth_user_id: "demo",
  phone: "",
  first_name: "Florentine",
  last_name: "D.",
  civility: null,
  payment_alias: null,
  payment_alias_type: null,
  onboarding_status: "done",
  created_at: "2026-07-05",
  updated_at: "2026-07-05",
  deleted_at: null,
}

// Dernière rangée non blanche du PNG (le bas de la page A4 est vide) —
// le recadrage suit le contenu réel, jamais un ratio codé en dur.
async function findContentBottom(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let y = info.height - 1; y >= 0; y--) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 245) return y
    }
  }
  return info.height - 1
}

function specimenOverlay(width: number, height: number): Buffer {
  const cx = width / 2
  const cy = height / 2
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${cx}" y="${cy}" transform="rotate(-30 ${cx} ${cy})"
        font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="700"
        letter-spacing="4" fill="#292929" fill-opacity="0.11" text-anchor="middle"
        dominant-baseline="middle">SPÉCIMEN — SANS VALEUR PROBANTE</text>
    </svg>`,
  )
}

async function main() {
  const qrDataUrl = await QRCode.toDataURL("https://www.monranti.com/verifier/demo", {
    margin: 0,
    width: 280,
  })

  const pdf = await renderToBuffer(
    <ReceiptPdf receipt={receipt} landlord={landlord} qrDataUrl={qrDataUrl} />,
  )

  const dir = mkdtempSync(path.join(tmpdir(), "quittance-demo-"))
  try {
    const pdfPath = path.join(dir, "quittance-demo.pdf")
    writeFileSync(pdfPath, pdf)

    execFileSync("qlmanage", ["-t", "-s", "2000", "-o", dir, pdfPath], { stdio: "inherit" })
    const rasterPath = path.join(dir, "quittance-demo.pdf.png")
    if (!existsSync(rasterPath)) {
      throw new Error(`qlmanage n'a pas produit ${rasterPath} — rasterisation PDF indisponible ?`)
    }

    const raster = await sharp(rasterPath).png().toBuffer()
    const { width = 0 } = await sharp(raster).metadata()
    const bottom = await findContentBottom(raster)
    const height = Math.min(bottom + 120, (await sharp(raster).metadata()).height ?? bottom + 120)

    await sharp(raster)
      .extract({ left: 0, top: 0, width, height })
      .composite([{ input: specimenOverlay(width, height) }])
      .png({ palette: true })
      .toFile(OUT_PATH)

    console.log(`OK → ${OUT_PATH} (${width}×${height})`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
