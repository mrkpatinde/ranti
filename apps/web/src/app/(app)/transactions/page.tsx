import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import {
  listPaymentTransactions,
  type PaymentProvider,
  type PaymentTransaction,
  type PaymentTransactionStatus,
} from "@/lib/payments"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

// ADR-018/ADR-019 — Vue ledger propriétaire (lecture seule) des paiements par
// le rail FeexPay. La validation (pending → quittance) vit dans /collections
// (surface d'action unique) ; ici, l'historique complet pour la traçabilité.
// Vision propriétaire : net reversé + frais Ranti « tout inclus », jamais les
// coûts PSP (invisibles par grants colonne côté base — ADR-018 v4).

const providerLabels: Record<PaymentProvider, string> = {
  feexpay: "FeexPay",
  fedapay: "FedaPay",
  kkiapay: "Kkiapay",
}

const statusLabels: Record<PaymentTransactionStatus, string> = {
  pending: "À valider",
  verified: "Validé",
  paid_out: "Reversé",
  rejected: "Non validé",
}

function statusClasses(status: PaymentTransactionStatus): string {
  switch (status) {
    case "pending":
      return "border-accent/50 bg-accent/10 text-accent"
    case "verified":
      return "border-primary/20 bg-secondary text-foreground"
    case "paid_out":
      return "border-primary/25 bg-secondary text-foreground"
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive"
  }
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

export default async function TransactionsPage() {
  const landlord = await requireLandlordProfile()

  const [transactions, leases, tenants, units] = await Promise.all([
    listPaymentTransactions(),
    getLandlordLeases(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordUnits(landlord.id),
  ])

  const tenantName = (id: string): string => {
    const t = tenants.find((tenant) => tenant.id === id)
    return t ? `${t.first_name} ${t.last_name}` : "Locataire"
  }
  const unitName = (id: string): string => units.find((u) => u.id === id)?.name ?? "Logement"
  const leaseParties = (leaseId: string): string => {
    const lease = leases.find((l) => l.id === leaseId)
    if (!lease) return "Locataire"
    return `${tenantName(lease.tenant_id)} — ${unitName(lease.unit_id)}`
  }

  // Total reçu par le rail = net des paiements aboutis (validés + reversés).
  const netReceived = transactions
    .filter((t) => t.status === "verified" || t.status === "paid_out")
    .reduce((sum, t) => sum + t.net_amount, 0)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <p className="mt-2 text-sm text-muted-foreground">Paiements par le rail</p>
        <Link
          href="/collections"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Encaissements
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-4xl">
            L&apos;historique de vos paiements par le rail
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Chaque loyer réglé par le rail de paiement est tracé ici, de la réception à la validation
            jusqu&apos;au reversement. Vous recevez le net, frais de service Ranti déduits.
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Aucun paiement par le rail pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Les loyers réglés par le rail de paiement apparaîtront ici.
            </p>
          </div>
        ) : (
          <>
            {netReceived > 0 ? (
              <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
                Total reçu par le rail :{" "}
                <span className="font-medium">{formatAmount(netReceived)}</span> net.
              </p>
            ) : null}

            <div className="space-y-4">
              {transactions.map((t: PaymentTransaction) => (
                <article key={t.id} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                        {formatAmount(t.amount_received)}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{leaseParties(t.lease_id)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(t.created_at)} · {providerLabels[t.provider]} ·{" "}
                        <span className="font-mono text-xs">{t.provider_reference}</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${statusClasses(t.status)}`}
                    >
                      {statusLabels[t.status]}
                    </span>
                  </div>

                  {t.status === "verified" || t.status === "paid_out" ? (
                    <p className="mt-3 text-sm text-foreground/80">
                      Net reçu{" "}
                      <span className="font-medium text-foreground">{formatAmount(t.net_amount)}</span>{" "}
                      · frais de service Ranti {(t.service_fee_bp / 100).toLocaleString("fr-FR")} %
                      tout inclus
                      {t.status === "paid_out" && t.paid_out_at
                        ? ` · reversé le ${formatDate(t.paid_out_at)}`
                        : ""}
                      .
                    </p>
                  ) : null}

                  {t.status === "pending" ? (
                    <Link
                      href="/collections"
                      className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Valider dans les encaissements
                    </Link>
                  ) : null}

                  {t.status === "rejected" && t.rejection_reason ? (
                    <p className="mt-3 text-sm text-muted-foreground">Motif : {t.rejection_reason}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
