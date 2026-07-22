import { buttonClasses } from "@/components/ui/button"
import { headers } from "next/headers"
import QRCode from "qrcode"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { badgeClasses, type BadgeVariant } from "@/components/ui/badge"
import { formatFcfa, monthYearLabel } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { receiptClause } from "@/lib/receipts/clause"
import { cancelReceipt, getReceipt } from "@/lib/receipts"
import type { ReceiptStatus, TenantAck } from "@/lib/receipts"
import { RantiLogo } from "@/components/ranti-logo"

type ReceiptDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const statusLabels: Record<ReceiptStatus, string> = {
  issued: "Émise",
  cancelled: "Annulée",
}

const methodLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
}

const kindLabels = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
} as const

const noticeLabels: Record<string, string> = {
  receipt_generated: "Document généré.",
  receipt_cancelled: "Document annulé. L’encaissement lié reste intact dans le registre.",
}

// ADR-013 — acquittement locataire, vu côté propriétaire.
const ackBadge: Record<TenantAck, { label: string; variant: BadgeVariant }> = {
  unilateral: { label: "En attente d’ouverture", variant: "neutral" },
  read: { label: "Ouvert, non confirmé", variant: "warning" },
  certified: { label: "Certifié par le locataire", variant: "success" },
  disputed: { label: "Contesté par le locataire", variant: "error" },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} → ${formatDate(end)}`
}

export default async function ReceiptDetailPage({ params, searchParams }: ReceiptDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  const receipt = await getReceipt(landlord.id, id)
  if (!receipt) notFound()

  const snap = receipt.snapshot ?? {}
  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  // Lien public à partager au locataire (ADR-013). Origine résolue depuis les
  // en-têtes, comme l'OAuth callback — marche en dev et en prod.
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  const proto = h.get("x-forwarded-proto") ?? "https"
  const shareUrl = host ? `${proto}://${host}/recu/${receipt.tenant_token}` : `/recu/${receipt.tenant_token}`
  const ack = ackBadge[receipt.tenant_ack]

  // Même QR que le PDF : l'URL publique de vérification du document. À
  // l'écran comme sur papier, la quittance se vérifie d'un scan.
  const verifyUrl = host ? `${proto}://${host}/verifier/${receipt.id}` : `/verifier/${receipt.id}`
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 160 })
  } catch {
    qrDataUrl = null
  }

  const waText = encodeURIComponent(
    `Voici votre reçu de loyer (${kindLabels[receipt.kind]}). Ouvrez-le et confirmez son exactitude : ${shareUrl}`,
  )
  // Lien profond vers la conversation du locataire (même mécanique que le
  // journal et les relances) : wa.me attend indicatif + numéro sans « + » ni
  // séparateur. Le wa.me sans numéro (mode « partager à… ») perd souvent le
  // message pré-rempli sur Android — on ne le garde qu'en repli sans téléphone.
  const tenantDigits = snap.tenant?.phone?.replace(/\D/g, "") ?? ""
  const waHref = tenantDigits
    ? `https://wa.me/${tenantDigits}?text=${waText}`
    : `https://wa.me/?text=${waText}`

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">{kindLabels[receipt.kind]}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/receipts/${receipt.id}/pdf`} className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95">Télécharger le PDF</a>
          <Link href="/receipts" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Tous les documents</Link>
        </div>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">{sp.error}</p> : null}

        {receipt.status === "cancelled" ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">Ce document est annulé. L’encaissement lié reste conservé dans le registre.</p> : null}

        <article className="rounded-2xl border border-border bg-card p-7 shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)]">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <RantiLogo size={36} />
              <div>
                <p className="font-display font-extrabold tracking-tight text-foreground">Ranti</p>
                <p className="text-xs text-muted-foreground">Registre de loyer</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-extrabold tracking-tight text-foreground">{kindLabels[receipt.kind]}</p>
              <p className="text-sm text-foreground/70">N° {receipt.receipt_number}</p>
              <p className="text-sm text-muted-foreground">Émise le {formatDate(receipt.issued_at)}</p>
              <span className={badgeClasses(ack.variant, "mt-1")}>{ack.label}</span>
              {receipt.status === "cancelled" ? <span className={badgeClasses("error", "mt-1 ml-1")}>{statusLabels[receipt.status]}</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-border py-5">
            <div>
              <p className="text-xs text-muted-foreground">De</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{landlord.first_name} {landlord.last_name}</p>
              <p className="text-sm text-foreground/70">Propriétaire</p>
              {landlord.phone ? <p className="text-sm text-foreground/70">{landlord.phone}</p> : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">À</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}` : "Locataire"}</p>
              <p className="text-sm text-foreground/70">Locataire</p>
              {snap.unit ? <p className="text-sm text-foreground/70">{snap.unit.name}</p> : null}
              {snap.property && (snap.property.address || snap.property.city) ? (
                <p className="text-sm text-foreground/70">{[snap.property.address, snap.property.city].filter(Boolean).join(", ")}</p>
              ) : null}
            </div>
          </div>

          {snap.allocations && snap.allocations.length > 0 ? (
            <div className="border-b border-border py-5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Période réglée</span><span>Montant</span></div>
              {snap.allocations.map((a, i) => (
                <div key={i} className="flex justify-between gap-4 py-1.5 text-sm">
                  <span className="text-foreground/80">{formatPeriod(a.period_start, a.period_end)}</span>
                  <span className="text-foreground [font-variant-numeric:tabular-nums]">{formatFcfa(a.amount_allocated)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 border-b border-dashed border-border py-5">
            <div>
              <p className="text-sm text-muted-foreground">Total payé</p>
              {snap.reception ? <p className="text-sm text-foreground/70">{methodLabels[snap.reception.payment_method] ?? snap.reception.payment_method} · reçu le {formatDate(snap.reception.received_at)}</p> : null}
            </div>
            <p className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground [font-variant-numeric:tabular-nums]">{formatFcfa(receipt.total_amount)}</p>
          </div>

          {/* Formule de quittance partagée : même formulation que la page locataire,
              le PDF et la modale FirstRun (revue 2026-07-18). */}
          <p className="py-4 text-sm leading-6 text-foreground/70">{receiptClause({ landlordName: `${landlord.first_name} ${landlord.last_name}`.trim() || "Propriétaire", tenantName: snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}`.trim() : "Locataire", amount: receipt.total_amount, kind: receipt.kind, period: snap.allocations?.length === 1 ? monthYearLabel(snap.allocations[0].period_start) : null })}</p>

          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL générée localement, next/image inutile
                <img src={qrDataUrl} alt={`QR de vérification du document ${receipt.receipt_number}`} className="h-16 w-16 rounded-lg border border-border bg-white p-1" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">QR</span>
              )}
              <a href={verifyUrl} className="max-w-[140px] text-xs text-muted-foreground underline-offset-4 hover:underline">Vérifier l&apos;authenticité en ligne</a>
            </div>
            <div className="text-center"><div className="w-40 border-t border-border pt-1.5 text-xs text-muted-foreground">Signature du propriétaire</div></div>
          </div>
        </article>

        {receipt.tenant_ack === "disputed" && receipt.contest_nature ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            <p className="font-medium">Le locataire conteste ce reçu.</p>
            <p className="mt-1">
              {receipt.contest_nature === "not_paid" && "Il déclare ne pas avoir payé ce loyer."}
              {receipt.contest_nature === "amount" &&
                `Il déclare avoir payé ${receipt.contested_amount != null ? formatFcfa(receipt.contested_amount) : "un autre montant"}.`}
              {receipt.contest_nature === "date" &&
                `Il indique une autre période : ${receipt.contested_period || "non précisée"}.`}
            </p>
            <p className="mt-2 text-xs text-destructive">Votre déclaration reste conservée. Corrigez le reçu (remplacement) si le locataire a raison.</p>
          </div>
        ) : null}

        {receipt.status === "issued" ? (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-foreground">Partager au locataire</p>
            <p className="text-sm text-muted-foreground">
              Envoyez ce lien : le locataire ouvre le reçu et confirme son exactitude (ou signale une erreur). C’est la deuxième voix qui rend le reçu certifié.
            </p>
            <p className="break-all rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground/80">{shareUrl}</p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
            >
              Partager sur WhatsApp
            </a>
          </section>
        ) : null}

        {receipt.status === "cancelled" ? <p className="text-sm text-muted-foreground">Motif d&apos;annulation : {receipt.cancellation_reason ?? "Motif non renseigné avant correction."}</p> : null}

        {receipt.status === "issued" ? (
          <form action={cancelReceipt} className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <input type="hidden" name="id" value={receipt.id} />
            <label htmlFor="reason" className="block text-sm font-medium text-foreground">Pourquoi annulez-vous cette quittance ?</label>
            <textarea id="reason" name="reason" rows={2} required minLength={3} placeholder="Ex. erreur de montant, paiement non reçu" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary" />
            <SubmitButton className={buttonClasses("destructive-outline")}>Annuler ce document</SubmitButton>
          </form>
        ) : null}
      </section>
    </main>
  )
}
