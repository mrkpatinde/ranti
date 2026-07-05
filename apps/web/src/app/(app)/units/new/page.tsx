import Link from "next/link"
import { redirect } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
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
  { value: "warehouse", label: "Entrepôt" },
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
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
  const labelClass = "block text-sm font-medium text-foreground"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Premier logement
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Quel logement voulez-vous ajouter ?
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Ajoutez seulement le logement qui peut recevoir un locataire.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <span
              key={example}
              className="rounded-full border border-border px-3 py-1 text-sm text-foreground/70"
            >
              {example}
            </span>
          ))}
        </div>

        <form action={createUnit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="property_id" className={labelClass}>
              Lieu <span className="text-red-700">*</span>
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
              Nom du logement <span className="text-red-700">*</span>
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
              Type <span className="text-red-700">*</span>
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
              Note <span className="text-muted-foreground">(optionnel)</span>
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
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <SubmitButton
            className="w-full rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            Ajouter ce logement
          </SubmitButton>

          <p className="text-center text-sm text-foreground/70">
            Plusieurs logements à ajouter ?{" "}
            <Link
              href="/units/bulk"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Les ajouter en une fois
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}
