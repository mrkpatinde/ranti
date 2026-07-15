import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { BailForm } from "./bail-form"

type NewLeasePageProps = {
  searchParams?: Promise<{ error?: string }>
}

// Entrée d'onboarding unique (ADR-020, welcome-flow v1.3) : un seul écran crée
// lieu + logement + occupant + bail et génère les échéances immédiatement, via
// la RPC atomique. Le lieu se crée inline ou se pioche (proprio établi).
export default async function NewLeasePage({ searchParams }: NewLeasePageProps) {
  const landlord = await requireLandlordProfile()
  const properties = await getLandlordProperties(landlord.id)
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Nouveau bail</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Retour
        </Link>
      </header>

      <section className="flex-1 space-y-8 py-8">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Créer un bail
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Lieu, logement, occupant et loyer en un geste. Le bail est activé et les
            échéances générées immédiatement.
          </p>
        </div>

        <BailForm
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          errorMessage={params?.error}
        />
      </section>
    </main>
  )
}
