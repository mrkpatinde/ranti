import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { formatFcfa } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { cancelReceipt, getReceipt } from "@/lib/receipts"
import type { ReceiptStatus } from "@/lib/receipts"
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

        <article className="rounded-2xl border border-border bg-card p-7 shadow-[0_14px_50px_-18px_rgba(22,56,40,0.22)]">
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
              {receipt.status === "cancelled" ? <span className="mt-1 inline-flex rounded-lg border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700">{statusLabels[receipt.status]}</span> : null}
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
