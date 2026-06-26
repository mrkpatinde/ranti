import Link from "next/link"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { createUnit } from "@/lib/units"

type NewUnitPageProps = {
  searchParams?: Promise<{
    error?: string
    property_id?: string
  }>
}

const UNIT_TYPE_OPTIONS = [
  { value: "room", label: "Chambre" },
  { value: "apartment", label: "Appartement" },
  { value: "house", label: "Maison" },
  { value: "shop", label: "Boutique" },
  { value: "store", label: "Magasin" },
  { value: "office", label: "Bureau" },
  { value: "warehouse", label: "Entrepot" },
  { value: "other", label: "Autre" },
]

const examples = ["Chambre 1", "Appartement haut", "Boutique droite", "Magasin A"]

export default async function NewUnitPage({ searchParams }: NewUnitPageProps) {
  const landlord = await requireLandlordProfile()
  const properties = await getLandlordProperties(landlord.id)

  if (properties.length === 0) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const selectedPropertyId = params?.property_id ?? properties[0]?.id
  const errorMessage = params?.error

  const inputClass =
    "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
  const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Premier logement
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Quel logement voulez-vous ajouter ?
          </h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Ajoutez seulement le logement qui peut recevoir un locataire.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <span
              key={example}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"
            >
              {example}
            </span>
          ))}
        </div>

        <form action={createUnit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="property_id" className={labelClass}>
              Lieu
            </label>
            <select
              id="property_id"
              name="property_id"
              required
              defaultValue={selectedPropertyId}
              className={inputClass}
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className={labelClass}>
              Nom du logement
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Ex. Chambre 1"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="unit_type" className={labelClass}>
              Type
            </label>
            <select
              id="unit_type"
              name="unit_type"
              required
              defaultValue="room"
              className={inputClass}
            >
              {UNIT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Note <span className="text-neutral-400">(optionnel)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Ex. au fond de la cour"
              className={inputClass}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Ajouter ce logement
          </button>
        </form>
      </section>
    </main>
  )
}
