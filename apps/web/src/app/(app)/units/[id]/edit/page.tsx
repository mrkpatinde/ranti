import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { getUnit, updateUnit } from "@/lib/units"

const UNIT_TYPE_OPTIONS = [
  { value: "room", label: "Chambre" },
  { value: "apartment", label: "Appartement" },
  { value: "house", label: "Maison" },
  { value: "shop", label: "Boutique" },
  { value: "store", label: "Magasin" },
  { value: "office", label: "Bureau" },
  { value: "warehouse", label: "Entrepôt" },
  { value: "other", label: "Autre" },
]

type EditUnitPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

export default async function EditUnitPage({ params, searchParams }: EditUnitPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const [unit, properties] = await Promise.all([
    getUnit(landlord.id, id),
    getLandlordProperties(landlord.id),
  ])

  if (!unit) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Modifier le logement</p>
        </div>
        <Link href={`/units/${unit.id}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">Retour</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Corriger ce logement</h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">Le lieu est affiché pour contexte. Pour le déplacer, créez plutôt un nouveau logement.</p>
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{sp.error}</p> : null}

        <form action={updateUnit} className="space-y-5">
          <input type="hidden" name="id" value={unit.id} />
          <div className="space-y-2">
            <label htmlFor="property_context" className={labelClass}>Lieu</label>
            <select id="property_context" value={unit.property_id} disabled className={inputClass}>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="name" className={labelClass}>Nom du logement</label>
            <input id="name" name="name" type="text" required defaultValue={unit.name} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="unit_type" className={labelClass}>Type</label>
            <select id="unit_type" name="unit_type" required defaultValue={unit.unit_type} className={inputClass}>
              {UNIT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>Note <span className="text-neutral-400">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={unit.notes ?? ""} className={inputClass} />
          </div>
          <SubmitButton className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">Enregistrer</SubmitButton>
        </form>
      </section>
    </main>
  )
}
