import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordProperties } from "@/lib/properties"
import { getLandlordUnits } from "@/lib/units"

const unitTypeLabels: Record<string, string> = {
  house: "Maison",
  apartment: "Appartement",
  room: "Chambre",
  shop: "Boutique",
  store: "Magasin",
  office: "Bureau",
  warehouse: "Entrepôt",
  other: "Autre",
}

type UnitsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  unit_archived: "Logement archivé.",
  bulk_units_created:
    "Logements ajoutés — encore libres. Créez leur bail quand ils trouveront leur occupant.",
}

export default async function UnitsPage({ searchParams }: UnitsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const [units, properties] = await Promise.all([
    getLandlordUnits(landlord.id),
    getLandlordProperties(landlord.id),
  ])
  const notice = params?.notice ? noticeLabels[params.notice] : null
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.name ?? "Lieu"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Vos logements</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Accueil</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">Les logements que vous louez</h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">Chaque logement peut recevoir un locataire et un bail.</p>
        </div>

        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {params?.error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">{params.error}</p> : null}

        {units.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Aucun logement pour le moment</h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">Ajoutez d’abord un logement pour pouvoir créer un bail.</p>
            <Link href="/leases/new" className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:brightness-95 lg:w-fit">Créer un bail</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {units.map((unit) => (
              <Link key={unit.id} href={`/units/${unit.id}`} className="block rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
                <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{unit.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{unitTypeLabels[unit.unit_type] ?? "Logement"} — {propertyName(unit.property_id)}</p>
                {unit.notes ? <p className="mt-3 text-sm text-muted-foreground">{unit.notes}</p> : null}
                <span className="mt-5 inline-flex text-sm font-medium text-foreground">Voir le détail</span>
              </Link>
            ))}
            <Link href="/leases/new" className="inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary">Créer un bail</Link>
          </div>
        )}
      </section>
    </main>
  )
}
