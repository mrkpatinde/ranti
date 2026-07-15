import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { getProperty } from "@/lib/properties"
import { archiveUnit, getUnit } from "@/lib/units"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordTenants } from "@/lib/tenants"

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

type UnitDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const unitTypeLabels: Record<string, string> = {
  house: "Maison",
  apartment: "Appartement",
  room: "Chambre",
  shop: "Boutique",
  store: "Magasin",
  office: "Bureau",
  warehouse: "Entrepôt",
  other: "Autre",
}

const availabilityLabels: Record<string, string> = {
  available: "Disponible",
  occupied: "Occupé",
}

const noticeLabels: Record<string, string> = {
  unit_updated: "Logement mis à jour.",
  availability_updated: "Statut mis à jour.",
}

export default async function UnitDetailPage({ params, searchParams }: UnitDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const unit = await getUnit(landlord.id, id)

  if (!unit) notFound()

  const [property, leases, tenants] = await Promise.all([
    getProperty(landlord.id, unit.property_id),
    getLandlordLeases(landlord.id),
    getLandlordTenants(landlord.id),
  ])
  // Bail de ce logement : l'actif d'abord, sinon le plus récent (drill-down
  // Logement → Locataire/bail).
  const unitLeases = leases
    .filter((l) => l.unit_id === unit.id)
    .sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : b.start_date.localeCompare(a.start_date)))
  const lease = unitLeases[0] ?? null
  const tenant = lease ? tenants.find((t) => t.id === lease.tenant_id) ?? null : null
  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Détail du logement</p>
        </div>
        <Link href={`/properties/${unit.property_id}`} className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Retour au lieu</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">{sp.error}</p> : null}

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{unit.name}</h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">{property?.name ?? "Lieu"}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Type</p>
            <p className="mt-3 text-lg font-medium text-foreground">{unitTypeLabels[unit.unit_type] ?? "Logement"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Statut</p>
            <p className="mt-3 text-lg font-medium text-foreground">{availabilityLabels[unit.availability_status] ?? unit.availability_status}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Locataire &amp; bail</h2>
          {lease ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatAmount(lease.monthly_rent_amount)} / mois · échéance le {lease.due_day}
                  </p>
                </div>
                <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-xs font-medium ${lease.status === "active" ? "border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
                  {lease.status === "active" ? "Bail actif" : "Bail " + lease.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href={`/leases/${lease.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">Voir le bail</Link>
                <Link href="/receipts" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Quittances</Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <p className="text-sm text-foreground/70">Aucun bail sur ce logement.</p>
              <Link href={`/leases/new?unit_id=${unit.id}`} className="mt-3 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                Créer le bail
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Note</p>
          <p className="mt-3 text-base leading-7 text-foreground/70">{unit.notes ?? "Aucune note pour ce logement."}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/units/${unit.id}/edit`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">Modifier ce logement</Link>
          <details>
            <summary className="inline-flex cursor-pointer list-none rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground/70 transition hover:border-red-300 hover:text-red-700">Archiver ce logement…</summary>
            <div className="mt-3 space-y-3 rounded-2xl border border-border bg-secondary/60 p-4">
              <p className="text-sm leading-6 text-foreground/80">
                ⓘ Archiver retire le logement de vos listes, <strong>sans rien effacer</strong> :
                l&apos;historique des baux, paiements et quittances liés reste conservé dans le registre.
                Un logement avec un bail actif ne peut pas être archivé : terminez d&apos;abord le bail.
              </p>
              <form action={archiveUnit}>
            <input type="hidden" name="id" value={unit.id} />
            <SubmitButton className="rounded-full border border-red-300 bg-card px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-700 disabled:opacity-60">Archiver ce logement</SubmitButton>
          </form>
            </div>
          </details>
        </div>
      </section>
    </main>
  )
}
