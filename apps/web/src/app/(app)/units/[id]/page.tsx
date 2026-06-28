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
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Détail du logement</p>
        </div>
        <Link href="/units" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">Vos logements</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{sp.error}</p> : null}

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">{unit.name}</h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">{property?.name ?? "Lieu"}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Type</p>
            <p className="mt-3 text-lg font-medium text-neutral-950 dark:text-neutral-50">{unitTypeLabels[unit.unit_type] ?? "Logement"}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Statut</p>
            <p className="mt-3 text-lg font-medium text-neutral-950 dark:text-neutral-50">{availabilityLabels[unit.availability_status] ?? unit.availability_status}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Note</p>
          <p className="mt-3 text-base leading-7 text-neutral-600 dark:text-neutral-300">{unit.notes ?? "Aucune note pour ce logement."}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/units/${unit.id}/edit`} className="inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">Modifier ce logement</Link>
          <form action={archiveUnit}>
            <input type="hidden" name="id" value={unit.id} />
            <SubmitButton className="rounded-xl border border-red-300 px-5 py-3 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-200 dark:hover:border-red-300">Archiver ce logement</SubmitButton>
          </form>
        </div>
      </section>
    </main>
  )
}
