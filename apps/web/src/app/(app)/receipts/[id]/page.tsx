import { headers } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { formatFcfa } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
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
const ackBadge: Record<TenantAck, { label: string; cls: string }> = {
  unilateral: { label: "En attente d’ouverture", cls: "border-border text-muted-foreground" },
  read: { label: "Ouvert, non confirmé", cls: "border-amber-300 text-amber-700" },
  certified: { label: "Certifié par le locataire", cls: "border-primary/30 text-primary" },
  disputed: { label: "Contesté par le locataire", cls: "border-red-300 text-red-700" },
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
  const waText = encodeURIComponent(
    `Voici votre reçu de loyer (${kindLabels[receipt.kind]}). Ouvrez-le et confirmez son exactitude : ${shareUrl}`,
  )

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">{kindLabels[receipt.kind]}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/receipts/${receipt.id}/pdf`} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">Télécharger le PDF</a>
          <Link href="/receipts" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Tous les documents</Link>
        </div>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">{sp.error}</p> : null}

        {receipt.status === "cancelled" ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">Ce document est annulé. L’encaissement lié reste conservé dans le registre.</p> : null}

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
              <span className={`mt-1 inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium ${ack.cls}`}>{ack.label}</span>
              {receipt.status === "cancelled" ? <span className="mt-1 ml-1 inline-flex rounded-lg border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700">{statusLabels[receipt.status]}</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-border py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">De</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{landlord.first_name} {landlord.last_name}</p>
              <p className="text-sm text-foreground/70">Propriétaire</p>
              {landlord.phone ? <p className="text-sm text-foreground/70">{landlord.phone}</p> : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">À</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}` : "Locataire"}</p>
              <p className="text-sm text-foreground/70">Locataire</p>
              {snap.unit ? <p className="text-sm text-foreground/70">{snap.unit.name}</p> : null}
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
            <p className="font-display text-3xl font-extrabold tracking-tight text-foreground [font-variant-numeric:tabular-nums]">{formatFcfa(receipt.total_amount)}</p>
          </div>

          <p className="py-4 text-sm leading-6 text-foreground/70">{receipt.kind === "quittance" ? "Le présent document vaut quittance : le loyer de la période ci-dessus est intégralement payé." : "Reçu de paiement pour la somme ci-dessus. Le loyer n’est pas intégralement soldé : ce document ne vaut pas quittance."}</p>

          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">QR</span>
              <span className="max-w-[140px] text-xs text-muted-foreground">Vérifier l&apos;authenticité en ligne (bientôt)</span>
            </div>
            <div className="text-center"><div className="w-40 border-t border-border pt-1.5 text-xs text-muted-foreground">Signature du propriétaire</div></div>
          </div>
        </article>

        {receipt.tenant_ack === "disputed" && receipt.contest_nature ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
            <p className="font-medium">Le locataire conteste ce reçu.</p>
            <p className="mt-1">
              {receipt.contest_nature === "not_paid" && "Il déclare ne pas avoir payé ce loyer."}
              {receipt.contest_nature === "amount" &&
                `Il déclare avoir payé ${receipt.contested_amount != null ? formatFcfa(receipt.contested_amount) : "un autre montant"}.`}
              {receipt.contest_nature === "date" &&
                `Il indique une autre période : ${receipt.contested_period || "non précisée"}.`}
            </p>
            <p className="mt-2 text-xs text-red-700">Votre déclaration reste conservée. Corrigez le reçu (remplacement) si le locataire a raison.</p>
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
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
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
            <SubmitButton className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60">Annuler ce document</SubmitButton>
          </form>
        ) : null}
      </section>
    </main>
  )
}
