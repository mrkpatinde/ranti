import { buttonClasses } from "@/components/ui/button"
import { formatFcfa } from "@/lib/format"
import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { Alert } from "@/components/ui/alert"
import { badgeClasses, type BadgeVariant } from "@/components/ui/badge"
import {
  cancelCollection,
  confirmCollection,
  getLandlordCollections,
  type Collection,
  type CollectionStatus,
  type PaymentMethod,
} from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import {
  listPaymentTransactions,
  verifyPaymentTransaction,
  type PaymentProvider,
  type PaymentTransaction,
} from "@/lib/payments"
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
  payment_transaction_verified:
    "Paiement validé. La quittance est prête dans « Vos quittances ».",
  payment_transaction_rejected:
    "Ce paiement n'a pas pu être validé : le montant ne correspond pas au loyer, ou le bail n'est plus actif. Il reste tracé dans le registre.",
}

const providerLabels: Record<PaymentProvider, string> = {
  feexpay: "FeexPay",
  fedapay: "FedaPay",
  kkiapay: "Kkiapay",
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

function statusVariant(status: CollectionStatus): BadgeVariant {
  switch (status) {
    case "draft":
      return "accent"
    case "confirmed":
      return "success"
    case "cancelled":
      return "neutral"
  }
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  const [collections, tenants, units, receipts, leases, transactions] = await Promise.all([
    getLandlordCollections(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
    getLandlordReceipts(landlord.id),
    getLandlordLeases(landlord.id),
    listPaymentTransactions(),
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

  // Rail PSP (FeexPay, ADR-019) : les transactions arrivent par le webhook en
  // `pending` et attendent la validation du propriétaire (ADR-017). Le ledger
  // ne stocke que le bail ; on retrouve locataire + logement par le bail.
  const leaseParties = (leaseId: string): string => {
    const lease = leases.find((l) => l.id === leaseId)
    if (!lease) return "Locataire"
    return `${tenantName(lease.tenant_id)} — ${unitName(lease.unit_id)}`
  }
  const pendingTransactions = transactions.filter((t: PaymentTransaction) => t.status === "pending")
  const rejectedTransactions = transactions.filter((t: PaymentTransaction) => t.status === "rejected")

  const sorted = [...collections].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return b.received_at.localeCompare(a.received_at)
  })

  const draftCount = collections.filter((c: Collection) => c.status === "draft").length
  const notice = params?.notice ? noticeLabels[params.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Vos encaissements</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/transactions"
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
          >
            Paiements par le rail
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
          >
            Accueil
          </Link>
        </div>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">
            Les loyers que vous avez reçus
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Chaque encaissement enregistré reste ici, même non confirmé. Vous ne perdez jamais la
            trace d&apos;un loyer reçu.
          </p>
          <Link
            href="/collections/new"
            className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
          >
            Encaisser un loyer
          </Link>
        </div>

        {notice ? <Alert variant="success">{notice}</Alert> : null}

        {params?.error ? <Alert variant="error">{params.error}</Alert> : null}

        {draftCount > 0 ? (
          <Alert variant="info">
            {draftCount === 1
              ? "1 encaissement en brouillon attend votre confirmation."
              : `${draftCount} encaissements en brouillon attendent votre confirmation.`}
          </Alert>
        ) : null}

        {pendingTransactions.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                Paiements par le rail à valider
              </h2>
              <p className="text-sm leading-6 text-foreground/70">
                Un locataire a réglé son loyer par le rail de paiement. Validez pour générer la
                quittance ; vous recevez le net, frais de service Ranti déduits.
              </p>
            </div>
            {pendingTransactions.map((t) => (
              <article
                key={t.id}
                className="rounded-2xl border border-accent/50 bg-accent/10 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                      {formatFcfa(t.amount_received)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{leaseParties(t.lease_id)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(t.created_at)} · {providerLabels[t.provider]}
                    </p>
                  </div>
                  <span className={badgeClasses("accent")}>
                    À valider
                  </span>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  Réf. transaction :{" "}
                  <span className="font-mono text-xs text-foreground">{t.provider_reference}</span>
                </p>

                <p className="mt-3 text-sm text-foreground/80">
                  Vous recevez{" "}
                  <span className="font-medium text-foreground">{formatFcfa(t.net_amount)}</span>{" "}
                  net · frais de service Ranti {(t.service_fee_bp / 100).toLocaleString("fr-FR")} %
                  tout inclus.
                </p>

                <form action={verifyPaymentTransaction} className="mt-5">
                  <input type="hidden" name="transaction_id" value={t.id} />
                  <SubmitButton className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60">
                    Valider et générer la quittance
                  </SubmitButton>
                </form>
              </article>
            ))}
          </div>
        ) : null}

        {rejectedTransactions.length > 0 ? (
          <details className="rounded-2xl border border-border bg-card p-6">
            <summary className="cursor-pointer list-none font-display text-lg font-extrabold tracking-tight text-foreground">
              Paiements du rail non validés ({rejectedTransactions.length})
            </summary>
            <div className="mt-4 space-y-3">
              {rejectedTransactions.map((t) => (
                <div key={t.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatFcfa(t.amount_received)} — {leaseParties(t.lease_id)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(t.created_at)} · {providerLabels[t.provider]} ·{" "}
                        <span className="font-mono text-xs">{t.provider_reference}</span>
                      </p>
                    </div>
                    <span className={badgeClasses("error")}>
                      Non validé
                    </span>
                  </div>
                  {t.rejection_reason ? (
                    <p className="mt-2 text-sm text-muted-foreground">Motif : {t.rejection_reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
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
                      {formatFcfa(c.amount_received)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tenantName(c.tenant_id)} — {unitName(c.unit_id)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(c.received_at)} · {methodLabels[c.payment_method]}
                    </p>
                  </div>
                  <span className={badgeClasses(statusVariant(c.status))}>
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
                        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60"
                      >
                        Confirmer
                      </SubmitButton>
                    </form>

                    <form action={cancelCollection} className="space-y-2 rounded-2xl border border-border p-4">
                      <input type="hidden" name="id" value={c.id} />
                      <label htmlFor={`reason-${c.id}`} className="block text-sm font-medium text-foreground">
                        Motif d&apos;annulation <span className="text-destructive">*</span>
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
                        className={buttonClasses("destructive-outline")}
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
                      className="mt-5 inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary"
                    >
                      Voir le document
                    </Link>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {cancelledReceiptReceptions.has(c.id) ? (
                        <p className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-6 text-accent">
                          ⓘ Le document de cet encaissement a été <strong>annulé</strong>, mais le paiement reste
                          confirmé dans le registre. Générez un document corrigé — ou annulez aussi
                          l&apos;encaissement ci-dessous s&apos;il a été saisi par erreur.
                        </p>
                      ) : null}
                      <form action={generateReceipt}>
                        <input type="hidden" name="reception_id" value={c.id} />
                        <SubmitButton
                          className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary disabled:opacity-60"
                        >
                          {cancelledReceiptReceptions.has(c.id) ? "Générer un document corrigé" : "Générer la quittance ou le reçu"}
                        </SubmitButton>
                      </form>
                      <details>
                        <summary className="inline-flex cursor-pointer list-none rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground/70 transition hover:border-destructive/40 hover:text-destructive">Annuler cet encaissement…</summary>
                        <form action={cancelCollection} className="mt-3 space-y-2 rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
                          <input type="hidden" name="id" value={c.id} />
                          <p className="text-sm leading-6 text-destructive">
                            L&apos;annulation remet l&apos;échéance en attente (le loyer redevient dû) et reste tracée
                            dans le registre avec son motif. Elle est impossible tant qu&apos;un document actif existe.
                          </p>
                          <label htmlFor={`reason-confirmed-${c.id}`} className="block text-sm font-medium text-destructive">
                            Motif d&apos;annulation <span className="text-destructive">*</span>
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
                          <SubmitButton className={buttonClasses("destructive-outline")}>
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
