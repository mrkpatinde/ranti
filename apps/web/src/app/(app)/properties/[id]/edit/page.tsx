import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { getProperty, updateProperty } from "@/lib/properties"

type EditPropertyPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

export default async function EditPropertyPage({ params, searchParams }: EditPropertyPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const property = await getProperty(landlord.id, id)

  if (!property) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Modifier le lieu</p>
        </div>
        <Link href={`/properties/${property.id}`} className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Corriger ce lieu</h1>
          <p className="text-base leading-7 text-foreground/70">
            Gardez un nom simple : maison, cour, immeuble ou boutique.
          </p>
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</p> : null}

        <form action={updateProperty} className="space-y-5">
          <input type="hidden" name="id" value={property.id} />
          <div className="space-y-2">
            <label htmlFor="name" className={labelClass}>Nom du lieu</label>
            <input id="name" name="name" type="text" required defaultValue={property.name} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="city" className={labelClass}>Ville <span className="text-muted-foreground">(optionnel)</span></label>
            <input id="city" name="city" type="text" defaultValue={property.city ?? ""} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="address" className={labelClass}>Adresse ou repère <span className="text-muted-foreground">(optionnel)</span></label>
            <input id="address" name="address" type="text" defaultValue={property.address ?? ""} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>Note <span className="text-muted-foreground">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={property.notes ?? ""} className={inputClass} />
          </div>
          <SubmitButton className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
            Enregistrer
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
