import Link from "next/link"
import { notFound } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { getProperty } from "@/lib/properties"

type PropertyDetailPageProps = {
  searchParams?: Promise<{
    id?: string
  }>
}

function formatLocation(city: string | null, address: string | null) {
  const parts = [city, address].filter(Boolean)
  return parts.length > 0 ? parts.join(" - ") : "Aucun repere renseigne"
}

export default async function PropertyDetailPage({ searchParams }: PropertyDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  if (!params?.id) {
    notFound()
  }

  const property = await getProperty(landlord.id, params.id)

  if (!property) {
    notFound()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Detail du lieu
          </p>
        </div>
        <Link
          href="/properties"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Vos lieux
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {property.name}
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            {formatLocation(property.city, property.address)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Ville
          </p>
          <p className="mt-3 text-lg font-medium text-foreground">
            {property.city ?? "Non renseignee"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Repere
          </p>
          <p className="mt-3 text-lg font-medium text-foreground">
            {property.address ?? "Non renseigne"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Note
          </p>
          <p className="mt-3 text-base leading-7 text-foreground/70">
            {property.notes ?? "Aucune note pour ce lieu."}
          </p>
        </div>
      </section>
    </main>
  )
}
