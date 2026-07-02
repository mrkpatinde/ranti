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
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

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
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Modifier le logement</p>
        </div>
        <Link href={`/units/${unit.id}`} className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Retour</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Corriger ce logement</h1>
          <p className="text-base leading-7 text-foreground/70">Le lieu est affiché pour contexte. Pour le déplacer, créez plutôt un nouveau logement.</p>
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</p> : null}

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
            <label htmlFor="notes" className={labelClass}>Note <span className="text-muted-foreground">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={unit.notes ?? ""} className={inputClass} />
          </div>
          <SubmitButton className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">Enregistrer</SubmitButton>
        </form>
      </section>
    </main>
  )
}
