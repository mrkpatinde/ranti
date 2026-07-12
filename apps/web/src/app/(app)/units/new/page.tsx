import Link from "next/link"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { UnitCreateForm } from "./unit-create-form"

type NewUnitPageProps = {
  searchParams?: Promise<{
    error?: string
    property_id?: string
    occupied?: string
  }>
}

const examples = ["Chambre 1", "Appartement haut", "Boutique droite", "Magasin A"]

export default async function NewUnitPage({ searchParams }: NewUnitPageProps) {
  const landlord = await requireLandlordProfile()
  const properties = await getLandlordProperties(landlord.id)

  if (properties.length === 0) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const selectedPropertyId = params?.property_id ?? properties[0]?.id ?? ""
  const errorMessage = params?.error
  const occupiedDefault = params?.occupied === "1"

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

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <UnitCreateForm
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          selectedPropertyId={selectedPropertyId}
          occupiedDefault={occupiedDefault}
        />
      </section>
    </main>
  )
}
