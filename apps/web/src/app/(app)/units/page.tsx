import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { getLandlordUnits } from "@/lib/units"

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

type UnitsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  unit_archived: "Logement archivé.",
}

export default async function UnitsPage({ searchParams }: UnitsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const [units, properties] = await Promise.all([
    getLandlordUnits(landlord.id),
    getLandlordProperties(landlord.id),
  ])
  const notice = params?.notice ? noticeLabels[params.notice] : null
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.name ?? "Lieu"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Vos logements</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">Tableau de bord</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">Les logements que vous louez</h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">Chaque logement peut recevoir un locataire et un bail.</p>
        </div>

        {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p> : null}
        {params?.error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{params.error}</p> : null}

        {units.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Aucun logement pour le moment</h2>
            <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">Ajoutez d’abord un logement pour pouvoir créer un bail.</p>
            <Link href="/units/new" className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">Ajouter un logement</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {units.map((unit) => (
              <Link key={unit.id} href={`/units/${unit.id}`} className="block rounded-3xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-50">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{unit.name}</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{unitTypeLabels[unit.unit_type] ?? "Logement"} — {propertyName(unit.property_id)}</p>
                {unit.notes ? <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{unit.notes}</p> : null}
                <span className="mt-5 inline-flex text-sm font-medium text-neutral-950 dark:text-neutral-50">Voir le détail</span>
              </Link>
            ))}
            <Link href="/units/new" className="inline-flex rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50">Ajouter un autre logement</Link>
          </div>
        )}
      </section>
    </main>
  )
}
