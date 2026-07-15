import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { archiveProperty, getProperty } from "@/lib/properties"
import { getLandlordUnits } from "@/lib/units"

const unitTypeLabels: Record<string, string> = {
  room: "Chambre",
  apartment: "Appartement",
  house: "Maison",
  shop: "Boutique",
  store: "Magasin",
  office: "Bureau",
  warehouse: "Entrepôt",
  other: "Logement",
}

type PropertyDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  property_updated: "Lieu mis à jour.",
}

function formatLocation(city: string | null, address: string | null) {
  const parts = [city, address].filter(Boolean)
  return parts.length > 0 ? parts.join(" - ") : "Aucun repère renseigné"
}

export default async function PropertyDetailPage({ params, searchParams }: PropertyDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const property = await getProperty(landlord.id, id)

  if (!property) notFound()

  const allUnits = await getLandlordUnits(landlord.id)
  const units = allUnits.filter((u) => u.property_id === property.id)

  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Détail du lieu</p>
        </div>
        <Link href="/properties" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Vos lieux
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">{sp.error}</p> : null}

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">{property.name}</h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">{formatLocation(property.city, property.address)}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Ville</p>
            <p className="mt-3 text-lg font-medium text-foreground">{property.city ?? "Non renseignée"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Repère</p>
            <p className="mt-3 text-lg font-medium text-foreground">{property.address ?? "Non renseigné"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Note</p>
          <p className="mt-3 text-base leading-7 text-foreground/70">{property.notes ?? "Aucune note pour ce lieu."}</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Logements</h2>
            <Link href="/leases/new" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Créer un bail
            </Link>
          </div>
          {units.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-foreground/70">
              Aucun logement dans ce lieu. Ajoutez-en un pour lui rattacher un locataire et un bail.
            </p>
          ) : (
            <div className="space-y-3">
              {units.map((unit) => (
                <Link key={unit.id} href={`/units/${unit.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition hover:border-primary">
                  <div>
                    <p className="font-medium text-foreground">{unit.name}</p>
                    <p className="text-sm text-muted-foreground">{unitTypeLabels[unit.unit_type] ?? "Logement"}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-xs font-medium ${unit.availability_status === "occupied" ? "border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
                    {unit.availability_status === "occupied" ? "Occupé" : "Vacant"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/properties/${property.id}/edit`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
            Modifier ce lieu
          </Link>
          <form action={archiveProperty}>
            <input type="hidden" name="id" value={property.id} />
            <SubmitButton className="rounded-full border border-red-300 px-5 py-3 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60">
              Archiver ce lieu
            </SubmitButton>
          </form>
        </div>
      </section>
    </main>
  )
}
