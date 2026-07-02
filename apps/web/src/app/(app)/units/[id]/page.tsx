import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { getProperty } from "@/lib/properties"
import { archiveUnit, getUnit } from "@/lib/units"

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

  const property = await getProperty(landlord.id, unit.property_id)
  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Détail du logement</p>
        </div>
        <Link href="/units" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Vos logements</Link>
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
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Type</p>
            <p className="mt-3 text-lg font-medium text-foreground">{unitTypeLabels[unit.unit_type] ?? "Logement"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Statut</p>
            <p className="mt-3 text-lg font-medium text-foreground">{availabilityLabels[unit.availability_status] ?? unit.availability_status}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Note</p>
          <p className="mt-3 text-base leading-7 text-foreground/70">{unit.notes ?? "Aucune note pour ce logement."}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/units/${unit.id}/edit`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">Modifier ce logement</Link>
          <form action={archiveUnit}>
            <input type="hidden" name="id" value={unit.id} />
            <SubmitButton className="rounded-full border border-red-300 px-5 py-3 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60">Archiver ce logement</SubmitButton>
          </form>
        </div>
      </section>
    </main>
  )
}
