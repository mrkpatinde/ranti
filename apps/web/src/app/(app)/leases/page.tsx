import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import type { LeaseStatus } from "@/lib/leases"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

type LeasesPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const leaseStatusLabels: Record<LeaseStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  ended: "Terminé",
  cancelled: "Annulé",
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

export default async function LeasesPage({ searchParams }: LeasesPageProps) {
  const landlord = await requireLandlordProfile()
  await searchParams
  const [leases, units, tenants] = await Promise.all([
    getLandlordLeases(landlord.id),
    getLandlordUnits(landlord.id),
    getLandlordTenants(landlord.id),
  ])

  const unitName = (id: string): string => units.find((u) => u.id === id)?.name ?? "Logement"
  const tenantName = (id: string): string => {
    const t = tenants.find((tenant) => tenant.id === id)
    return t ? `${t.first_name} ${t.last_name}` : "Locataire"
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Vos baux</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
            Vos baux
          </h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Un bail relie un logement à un locataire. Activez-le pour générer les loyers.
          </p>
        </div>

        {leases.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Aucun bail pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Créez un bail entre un logement et un locataire.
            </p>
            <Link
              href="/leases/new"
              className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Créer mon premier bail
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {leases.map((lease) => (
              <Link
                key={lease.id}
                href={`/leases/${lease.id}`}
                className="block rounded-3xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                      {tenantName(lease.tenant_id)} — {unitName(lease.unit_id)}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {formatAmount(lease.monthly_rent_amount)} / mois · échéance le {lease.due_day}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                    {leaseStatusLabels[lease.status]}
                  </span>
                </div>
              </Link>
            ))}

            <Link
              href="/leases/new"
              className="inline-flex rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
            >
              Créer un autre bail
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
