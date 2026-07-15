import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import type { LeaseStatus } from "@/lib/leases"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

type LeasesPageProps = {
  searchParams?: Promise<{
    notice?: string
    error?: string
    units?: string
    leases?: string
  }>
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
  const params = await searchParams
  const bulkNotice =
    params?.notice === "bulk_created"
      ? `${params.units ?? "0"} logement(s) ajouté(s)` +
        (params.leases && params.leases !== "0"
          ? `, ${params.leases} bail/baux activé(s) — loyers générés.`
          : ".")
      : params?.notice === "unit_occupied_created"
        ? "Logement, locataire et bail créés — loyers générés."
        : null
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Vos baux</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">
            Vos baux
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Un bail relie un logement à un locataire. Activez-le pour générer les loyers.
          </p>
        </div>

        {bulkNotice ? (
          <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
            {bulkNotice}
          </p>
        ) : null}

        {leases.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Aucun bail pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Créez un bail entre un logement et un locataire.
            </p>
            <Link
              href="/leases/new"
              className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
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
                className="block rounded-2xl border border-border bg-card p-6 transition hover:border-primary"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                      {tenantName(lease.tenant_id)} — {unitName(lease.unit_id)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatAmount(lease.monthly_rent_amount)} / mois · échéance le {lease.due_day}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80">
                    {leaseStatusLabels[lease.status]}
                  </span>
                </div>
              </Link>
            ))}

            <Link
              href="/leases/new"
              className="inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary"
            >
              Créer un autre bail
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
