import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { allocateReception, getCollection } from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordDueBalances } from "@/lib/rent-dues"
import { getTenant } from "@/lib/tenants"
import { getUnit } from "@/lib/units"

// Affecter un encaissement Fast-Log (collage SMS) à ses échéances (ADR-014).
// L'argent est déjà enregistré et confirmé : ici on dit seulement QUELLES
// échéances il solde. Le reçu déjà émis reste valable comme preuve du paiement.

type AllocatePageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function AllocateReceptionPage({ params, searchParams }: AllocatePageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  const reception = await getCollection(landlord.id, id)
  if (!reception) notFound()

  const [tenant, unit, balances] = await Promise.all([
    getTenant(landlord.id, reception.tenant_id),
    getUnit(landlord.id, reception.unit_id),
    getLandlordDueBalances(landlord.id),
  ])

  // Échéances de CE locataire dans CE logement qui doivent encore quelque chose,
  // les plus anciennes d'abord (on solde la dette la plus vieille en premier).
  const unpaid = balances
    .filter(
      (d) =>
        d.tenant_id === reception.tenant_id &&
        d.unit_id === reception.unit_id &&
        (d.status === "expected" || d.status === "overdue"),
    )
    .map((d) => ({ ...d, remaining: Math.max(0, d.amount_due - d.amount_paid) }))
    .filter((d) => d.remaining > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  // Le crédit disponible est ventilé de la plus ancienne échéance à la plus
  // récente, sans jamais dépasser le montant réellement reçu.
  let leftover = reception.amount_received
  const suggestion = new Map<string, number>()
  for (const due of unpaid) {
    const alloc = Math.min(due.remaining, Math.max(0, leftover))
    suggestion.set(due.id, alloc)
    leftover -= alloc
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <h1 className="font-display text-xl font-extrabold tracking-tight">Affecter cet encaissement</h1>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:underline">
          Journal
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}
          </p>
          <p className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl">
            {formatAmount(reception.amount_received)}
          </p>
          <p className="text-base leading-7 text-foreground/70">
            Cet argent est déjà enregistré. Indiquez seulement quelles échéances il solde.
            {reception.payment_reference ? ` Réf. ${reception.payment_reference}.` : ""}
          </p>
        </div>

        {sp?.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {sp.error}
          </p>
        ) : null}

        {unpaid.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm">
              Aucune échéance à solder pour ce locataire dans ce logement. Le crédit reste disponible.
            </p>
            <Link href="/dashboard" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Retour au journal
            </Link>
          </div>
        ) : (
          <form action={allocateReception} className="space-y-6">
            <input type="hidden" name="reception_id" value={reception.id} />

            <div className="space-y-3">
              <p className="block text-sm font-semibold">Échéances à solder</p>
              <p className="text-sm text-muted-foreground">
                Laissez 0 pour ne pas affecter une échéance. Le total ne peut pas dépasser {formatAmount(reception.amount_received)}.
              </p>

              {unpaid.map((due) => (
                <div
                  key={due.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/60 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">reste {formatAmount(due.remaining)}</p>
                    <p className="text-sm text-muted-foreground">
                      échéance {formatDate(due.due_date)}
                      {due.amount_paid > 0 ? ` · ${formatAmount(due.amount_paid)} déjà reçu` : ""}
                    </p>
                  </div>
                  <input type="hidden" name="allocation_due_id" value={due.id} />
                  <input
                    name="allocation_amount"
                    type="text"
                    inputMode="numeric"
                    defaultValue={String(suggestion.get(due.id) ?? 0)}
                    aria-label={`Montant affecté à l'échéance du ${formatDate(due.due_date)}`}
                    className="w-32 rounded-xl border border-border bg-card px-3 py-2 text-base outline-none transition focus:border-primary"
                  />
                </div>
              ))}
            </div>

            {leftover > 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {formatAmount(leftover)} resteront en crédit non affecté après cette affectation.
              </p>
            ) : null}

            <SubmitButton className="w-full rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:brightness-95 disabled:opacity-60 lg:w-fit">
              Affecter aux échéances
            </SubmitButton>
          </form>
        )}
      </section>
    </main>
  )
}
