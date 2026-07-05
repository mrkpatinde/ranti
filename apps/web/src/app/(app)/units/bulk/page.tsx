import Link from "next/link"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { BulkOnboardForm } from "./bulk-onboard-form"

// Onboarding groupé : le propriétaire ajoute plusieurs logements d'un coup,
// chacun éventuellement avec son locataire et son bail (activé, échéances
// générées). Corrige le cul-de-sac du flux unitaire (un logement -> locataire).

export default async function BulkUnitsPage() {
  const landlord = await requireLandlordProfile()
  const properties = await getLandlordProperties(landlord.id)

  // Comme /units/new : sans propriété, rien à quoi rattacher un logement.
  if (properties.length === 0) {
    redirect("/dashboard")
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground">
            Ajouter plusieurs logements
          </h1>
        </div>
        <Link
          href="/units"
          className="shrink-0 text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour
        </Link>
      </header>

      <BulkOnboardForm
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />
    </main>
  )
}
