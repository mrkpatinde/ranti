import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import {
  cancelCollection,
  confirmCollection,
  getLandlordCollections,
  type Collection,
  type CollectionStatus,
  type PaymentMethod,
} from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { generateReceipt, getLandlordReceipts } from "@/lib/receipts"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

type CollectionsPageProps = {
  searchParams?: Promise<{
    notice?: string
    error?: string
  }>
}

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
}

const statusLabels: Record<CollectionStatus, string> = {
  draft: "Brouillon — à confirmer",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

const noticeLabels: Record<string, string> = {
  collection_confirmed: "Encaissement confirmé.",
  collection_confirmed_document_pending:
    "Encaissement confirmé. Le document n'a pas été généré automatiquement ; vous pouvez le générer depuis l'encaissement.",
  collection_cancelled: "Encaissement annulé.",
  collection_recorded_unconfirmed:
    "Encaissement enregistré mais non confirmé. Confirmez-le ci-dessous.",
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

const statusOrder: Record<CollectionStatus, number> = {
  draft: 0,
  confirmed: 1,
  cancelled: 2,
}

function statusClasses(status: CollectionStatus): string {
  switch (status) {
    case "draft":
      return "border-accent/50 bg-accent/10 text-accent-foreground"
    case "confirmed":
      return "border-primary/20 bg-secondary text-foreground"
    case "cancelled":
      return "border-border bg-background text-foreground/70"
  }
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  const [collections, tenants, units, receipts] = await Promise.all([
    getLandlordCollections(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
    getLandlordReceipts(landlord.id),
  ])

  const receiptByReception = new Map(
    receipts.filter((r) => r.status !== "cancelled").map((r) => [r.rent_reception_id, r]),
  )
  // Encaissements dont le document a été annulé (flux de correction) :
  // l'encaissement reste confirmé, il faut le dire clairement au propriétaire.
  const cancelledReceiptReceptions = new Set(
    receipts.filter((r) => r.status === "cancelled").map((r) => r.rent_reception_id),
  )

  const tenantName = (id: string): string => {
    const t = tenants.find((tenant) => tenant.id === id)
    return t ? `${t.first_name} ${t.last_name}` : "Locataire"
  }
  const unitName = (id: string): string => units.find((u) => u.id === id)?.name ?? "Logement"

  const sorted = [...collections].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return b.received_at.localeCompare(a.received_at)
  })

  const draftCount = collections.filter((c: Collection) => c.status === "draft").length
  const notice = params?.notice ? noticeLabels[params.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Vos encaissements</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Les loyers que vous avez reçus
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Chaque encaissement enregistré reste ici, même non confirmé. Vous ne perdez jamais la
            trace d&apos;un loyer reçu.
          </p>
          <Link
            href="/collections/new"
            className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Encaisser un loyer
          </Link>
        </div>

        {notice ? (
          <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
            {notice}
          </p>
        ) : null}

        {params?.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
            {params.error}
          </p>
        ) : null}

        {draftCount > 0 ? (
          <p className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-accent-foreground">
            {draftCount === 1
              ? "1 encaissement en brouillon attend votre confirmation."
              : `${draftCount} encaissements en brouillon attendent votre confirmation.`}
          </p>
        ) : null}

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Aucun encaissement pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Les loyers que vous enregistrerez apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((c) => (
              <article
                key={c.id}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                      {formatAmount(c.amount_received)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tenantName(c.tenant_id)} — {unitName(c.unit_id)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(c.received_at)} · {methodLabels[c.payment_method]}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${statusClasses(c.status)}`}
                  >
                    {statusLabels[c.status]}
                  </span>
                </div>

                {c.payment_reference ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Réf. transaction : <span className="font-medium text-foreground">{c.payment_reference}</span>
                  </p>
                ) : null}

                {c.note ? (
                  <p className="mt-3 text-sm text-muted-foreground">{c.note}</p>
                ) : null}

                {c.status === "cancelled" && c.cancellation_reason ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Motif : {c.cancellation_reason}
                  </p>
                ) : null}

                {c.status === "draft" ? (
                  <div className="mt-5 space-y-4">
                    <form action={confirmCollection}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton
                        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        Confirmer
                      </SubmitButton>
                    </form>

                    <form action={cancelCollection} className="space-y-2 rounded-2xl border border-border p-4">
                      <input type="hidden" name="id" value={c.id} />
                      <label htmlFor={`reason-${c.id}`} className="block text-sm font-medium text-foreground">
                        Motif d&apos;annulation <span className="text-red-700">*</span>
                      </label>
                      <textarea
                        id={`reason-${c.id}`}
                        name="reason"
                        rows={2}
                        required
                        minLength={3}
                        placeholder="Ex. paiement saisi par erreur"
                        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                      />
                      <SubmitButton
                        className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
                      >
                        Annuler cet encaissement
                      </SubmitButton>
                    </form>
                  </div>
                ) : null}

                {c.status === "confirmed" ? (
                  receiptByReception.has(c.id) ? (
                    <Link
                      href={`/receipts/${receiptByReception.get(c.id)!.id}`}
                      className="mt-5 inline-flex rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary"
                    >
                      Voir le document
                    </Link>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {cancelledReceiptReceptions.has(c.id) ? (
                        <p className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-6 text-accent-foreground">
                          ⓘ Le document de cet encaissement a été <strong>annulé</strong>, mais le paiement reste
                          confirmé dans le registre. Générez un document corrigé — ou annulez aussi
                          l&apos;encaissement ci-dessous s&apos;il a été saisi par erreur.
                        </p>
                      ) : null}
                      <form action={generateReceipt}>
                        <input type="hidden" name="reception_id" value={c.id} />
                        <SubmitButton
                          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary disabled:opacity-60"
                        >
                          {cancelledReceiptReceptions.has(c.id) ? "Générer un document corrigé" : "Générer la quittance ou le reçu"}
                        </SubmitButton>
                      </form>
                      <details>
                        <summary className="inline-flex cursor-pointer list-none rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/70 transition hover:border-red-300 hover:text-red-700">Annuler cet encaissement…</summary>
                        <form action={cancelCollection} className="mt-3 space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <input type="hidden" name="id" value={c.id} />
                          <p className="text-sm leading-6 text-red-900">
                            L&apos;annulation remet l&apos;échéance en attente (le loyer redevient dû) et reste tracée
                            dans le registre avec son motif. Elle est impossible tant qu&apos;un document actif existe.
                          </p>
                          <label htmlFor={`reason-confirmed-${c.id}`} className="block text-sm font-medium text-red-900">
                            Motif d&apos;annulation <span className="text-red-700">*</span>
                          </label>
                          <textarea
                            id={`reason-confirmed-${c.id}`}
                            name="reason"
                            rows={2}
                            required
                            minLength={3}
                            placeholder="Ex. montant saisi par erreur"
                            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                          />
                          <SubmitButton className="rounded-full border border-red-300 bg-card px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-700 disabled:opacity-60">
                            Annuler cet encaissement
                          </SubmitButton>
                        </form>
                      </details>
                    </div>
                  )
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
