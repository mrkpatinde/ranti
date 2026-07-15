import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"

type PropertiesPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  property_archived: "Lieu archivé.",
}

function formatLocation(city: string | null, address: string | null) {
  const parts = [city, address].filter(Boolean)
  return parts.length > 0 ? parts.join(" - ") : "Aucun repère renseigné"
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const properties = await getLandlordProperties(landlord.id)
  const notice = params?.notice ? noticeLabels[params.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Baux · vos lieux</p>
        </div>
        <Link href="/receipts" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Quittances
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Les lieux que vous suivez
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Une maison, un immeuble, une cour ou une boutique. Chaque lieu regroupe les logements que vous louez.
          </p>
        </div>

        {notice ? (
          <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
            {notice}
          </p>
        ) : null}
        {params?.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
            {params.error}
          </p>
        ) : null}

        {properties.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Aucun lieu pour le moment</h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Ajoutez d&apos;abord le premier endroit où vous encaissez un loyer.
            </p>
            <Link href="/properties/new" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              Ajouter mon premier lieu
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((property) => (
              <Link key={property.id} href={`/properties/${property.id}`} className="block rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
                <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{property.name}</h2>
                <p className="mt-2 text-base leading-7 text-foreground/70">
                  {formatLocation(property.city, property.address)}
                </p>
                {property.notes ? <p className="mt-3 text-sm text-muted-foreground">{property.notes}</p> : null}
                <span className="mt-5 inline-flex text-sm font-medium text-foreground underline-offset-4">Voir le détail</span>
              </Link>
            ))}

            <Link href="/properties/new" className="inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary">
              Ajouter un autre lieu
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
