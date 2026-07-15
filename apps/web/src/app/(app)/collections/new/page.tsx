import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { recordCollection } from "@/lib/collections"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases, getLease } from "@/lib/leases"
import { getLeaseDueBalances } from "@/lib/rent-dues"
import { getLandlordTenants, getTenant } from "@/lib/tenants"
import { getLandlordUnits, getUnit } from "@/lib/units"

type NewCollectionPageProps = {
  searchParams?: Promise<{ lease_id?: string; error?: string; amount?: string }>
}

// Montant pré-rempli depuis la saisie vocale (ADR-012 V1.1). On ne fait jamais
// confiance aveuglément : c'est un défaut relu et modifiable, jamais une écriture.
function parsePrefillAmount(raw: string | undefined): number | null {
  if (typeof raw !== "string") return null
  const digits = raw.replace(/\s/g, "")
  if (!/^\d+$/.test(digits)) return null
  const n = Number.parseInt(digits, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition focus:border-primary"
const labelClass = "block text-sm font-semibold"

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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight">{subtitle}</h1>
        </div>
        <Link href="/collections" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:underline">
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
      <Shell subtitle="Confirmer un paiement reçu">
        <div className="space-y-3">
          <p className="text-base leading-7 text-foreground/70">
            Le loyer vous a été payé hors Ranti — espèces ou Mobile Money. Choisissez le bail concerné : la quittance sera générée dès la confirmation.
          </p>
        </div>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-accent-foreground">
            Aucun bail actif. Activez un bail pour générer ses échéances, puis revenez confirmer un paiement.
          </p>
        ) : (
          <div className="space-y-3">
            {active.map((lease) => (
              <Link
                key={lease.id}
                href={`/collections/new?lease_id=${lease.id}`}
                className="block rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-primary hover:bg-secondary/60"
              >
                <p className="font-semibold">
                  {tenantName(lease.tenant_id)} — {unitName(lease.unit_id)}
                </p>
                <p className="text-sm text-muted-foreground">
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
      <Shell subtitle="Confirmer un paiement reçu">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          Bail introuvable.
        </p>
        <Link href="/collections/new" className="text-sm font-medium underline-offset-4 hover:underline">
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
  // Trié par date d'échéance croissante : on solde d'abord la plus ancienne.
  const unpaid = dues
    .filter((d) => d.status === "expected" || d.status === "overdue")
    .map((d) => ({ ...d, remaining: Math.max(0, d.amount_due - d.amount_paid) }))
    .filter((d) => d.remaining > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const total = unpaid.reduce((sum, d) => sum + d.remaining, 0)

  // Montant entendu à la voix (ex. « 80 000 en complément »). S'il est fourni,
  // il pré-remplit le champ « Montant reçu » et se ventile sur les échéances de
  // la plus ancienne à la plus récente. Sinon, on propose le total dû.
  const prefill = parsePrefillAmount(params.amount)
  const amountDefault = prefill ?? total
  let leftover = amountDefault
  const allocationDefault = new Map<string, number>()
  for (const due of unpaid) {
    const alloc = Math.min(due.remaining, Math.max(0, leftover))
    allocationDefault.set(due.id, alloc)
    leftover -= alloc
  }

  return (
    <Shell subtitle="Confirmer un paiement reçu">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">
          {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}
        </p>
        <p className="text-base leading-7 text-foreground/70">
          Le loyer vous a été payé hors Ranti — espèces ou Mobile Money. Confirmez-le : la quittance est générée automatiquement.
        </p>
      </div>

      {landlord.payment_alias ? (
        <p className="rounded-2xl border border-primary/15 bg-secondary px-4 py-3 text-sm leading-6 text-foreground/70">
          Astuce : vos locataires peuvent payer directement sur votre alias PI-SPI{" "}
          <span className="font-semibold text-foreground">{landlord.payment_alias}</span> — instantané et gratuit.
        </p>
      ) : null}

      {params.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {params.error}
        </p>
      ) : null}

      {unpaid.length === 0 ? (
        <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm">
          Aucune échéance à régler sur ce bail. Tout est à jour.
        </p>
      ) : (
        <form action={recordCollection} className="space-y-6">
          <input type="hidden" name="tenant_id" value={lease.tenant_id} />
          <input type="hidden" name="unit_id" value={lease.unit_id} />

          <div className="space-y-2">
            <label htmlFor="amount_received" className={labelClass}>
              Montant reçu (F CFA)
            </label>
            <input
              id="amount_received"
              name="amount_received"
              type="text"
              inputMode="numeric"
              required
              defaultValue={String(amountDefault)}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="payment_method" className={labelClass}>
              Mode de paiement
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
            <p className="text-sm text-muted-foreground">
              Le montant alloué réduit la dette. Laissez 0 pour ne pas allouer une échéance.
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
                  defaultValue={String(allocationDefault.get(due.id) ?? due.remaining)}
                  aria-label={`Montant alloué à l'échéance du ${formatDate(due.due_date)}`}
                  className="w-32 rounded-xl border border-border bg-card px-3 py-2 text-base outline-none transition focus:border-primary"
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
            className="w-full rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:brightness-95 disabled:opacity-60"
          >
            Confirmer le paiement reçu
          </SubmitButton>
        </form>
      )}
    </Shell>
  )
}
