import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"

function formatLocation(city: string | null, address: string | null) {
  const parts = [city, address].filter(Boolean)
  return parts.length > 0 ? parts.join(" - ") : "Aucun repere renseigne"
}

export default async function PropertiesPage() {
  const landlord = await requireLandlordProfile()
  const properties = await getLandlordProperties(landlord.id)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Vos lieux
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
            Les lieux que vous suivez
          </h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Une maison, un immeuble, une cour ou une boutique. Chaque lieu regroupe les logements que vous louez.
          </p>
        </div>

        {properties.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Aucun lieu pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Ajoutez d'abord le premier endroit ou vous encaissez un loyer.
            </p>
            <Link
              href="/properties/new"
              className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Ajouter mon premier lieu
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="block rounded-3xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-50"
              >
                <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                  {property.name}
                </h2>
                <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
                  {formatLocation(property.city, property.address)}
                </p>
                {property.notes ? (
                  <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    {property.notes}
                  </p>
                ) : null}
                <span className="mt-5 inline-flex text-sm font-medium text-neutral-950 underline-offset-4 dark:text-neutral-50">
                  Voir le detail
                </span>
              </Link>
            ))}

            <Link
              href="/properties/new"
              className="inline-flex rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
            >
              Ajouter un autre lieu
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
