import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { recordCollection } from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases, getLease } from "@/lib/leases"
import { getLeaseDueBalances } from "@/lib/rent-dues"
import { getLandlordTenants, getTenant } from "@/lib/tenants"
import { getLandlordUnits, getUnit } from "@/lib/units"

type NewCollectionPageProps = {
  searchParams?: Promise<{ lease_id?: string; error?: string }>
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Virement" },
  { value: "other", label: "Autre" },
]

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function Shell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        </div>
        <Link href="/collections" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Encaissements
        </Link>
      </header>
      <section className="flex flex-1 flex-col gap-8 py-10">{children}</section>
    </main>
  )
}

export default async function NewCollectionPage({ searchParams }: NewCollectionPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  // Step 1 — no lease chosen: pick an active lease to collect against.
  if (!params?.lease_id) {
    const [leases, units, tenants] = await Promise.all([
      getLandlordLeases(landlord.id),
      getLandlordUnits(landlord.id),
      getLandlordTenants(landlord.id),
    ])
    const active = leases.filter((l) => l.status === "active")
    const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "Logement"
    const tenantName = (id: string) => {
      const t = tenants.find((x) => x.id === id)
      return t ? `${t.first_name} ${t.last_name}` : "Locataire"
    }

    return (
      <Shell subtitle="Encaisser un loyer">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Pour quel bail ?
          </h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Choisissez le bail concerné par le loyer reçu.
          </p>
        </div>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Aucun bail actif. Activez un bail pour générer ses échéances, puis revenez encaisser.
          </p>
        ) : (
          <div className="space-y-3">
            {active.map((lease) => (
              <Link
                key={lease.id}
                href={`/collections/new?lease_id=${lease.id}`}
                className="block rounded-2xl border border-neutral-200 px-4 py-3 transition hover:border-neutral-950 dark:border-neutral-800 dark:hover:border-neutral-50"
              >
                <p className="font-medium text-neutral-950 dark:text-neutral-50">
                  {tenantName(lease.tenant_id)} — {unitName(lease.unit_id)}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {formatAmount(lease.monthly_rent_amount)} / mois
                </p>
              </Link>
            ))}
          </div>
        )}
      </Shell>
    )
  }

  // Step 2 — lease chosen: collect against its unpaid dues.
  const lease = await getLease(landlord.id, params.lease_id)
  if (!lease) {
    return (
      <Shell subtitle="Encaisser un loyer">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          Bail introuvable.
        </p>
        <Link href="/collections/new" className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200">
          Choisir un autre bail
        </Link>
      </Shell>
    )
  }

  const [tenant, unit, dues] = await Promise.all([
    getTenant(landlord.id, lease.tenant_id),
    getUnit(landlord.id, lease.unit_id),
    getLeaseDueBalances(landlord.id, lease.id),
  ])
  // Remaining = amount_due - already-paid; only dues still owing something.
  const unpaid = dues
    .filter((d) => d.status === "expected" || d.status === "overdue")
    .map((d) => ({ ...d, remaining: Math.max(0, d.amount_due - d.amount_paid) }))
    .filter((d) => d.remaining > 0)
  const total = unpaid.reduce((sum, d) => sum + d.remaining, 0)

  return (
    <Shell subtitle="Encaisser un loyer">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          Loyer reçu
        </h1>
        <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
          {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}
        </p>
      </div>

      {params.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {params.error}
        </p>
      ) : null}

      {unpaid.length === 0 ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Aucune échéance à régler sur ce bail. Tout est à jour.
        </p>
      ) : (
        <form action={recordCollection} className="space-y-6">
          <input type="hidden" name="tenant_id" value={lease.tenant_id} />
          <input type="hidden" name="unit_id" value={lease.unit_id} />

          <div className="space-y-2">
            <label htmlFor="amount_received" className={labelClass}>
              Montant reçu (FCFA)
            </label>
            <input
              id="amount_received"
              name="amount_received"
              type="text"
              inputMode="numeric"
              required
              defaultValue={String(total)}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="payment_method" className={labelClass}>
              Méthode
            </label>
            <select id="payment_method" name="payment_method" required defaultValue="cash" className={inputClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <p className={labelClass}>Échéances à régler</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Le montant alloué réduit la dette. Laissez 0 pour ne pas allouer une échéance.
            </p>
            {unpaid.map((due) => (
              <div
                key={due.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium text-neutral-950 dark:text-neutral-50">reste {formatAmount(due.remaining)}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    échéance {formatDate(due.due_date)}
                    {due.amount_paid > 0 ? ` · ${formatAmount(due.amount_paid)} déjà reçu` : ""}
                  </p>
                </div>
                <input type="hidden" name="allocation_due_id" value={due.id} />
                <input
                  name="allocation_amount"
                  type="text"
                  inputMode="numeric"
                  defaultValue={String(due.remaining)}
                  aria-label={`Montant alloué à l'échéance du ${formatDate(due.due_date)}`}
                  className="w-32 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="note" className={labelClass}>
              Note (optionnel)
            </label>
            <input id="note" name="note" type="text" placeholder="Réf. Mobile Money, remarque…" className={inputClass} />
          </div>

          <SubmitButton
            className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Enregistrer l&apos;encaissement
          </SubmitButton>
        </form>
      )}
    </Shell>
  )
}
