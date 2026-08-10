import Link from "next/link"
import { notFound } from "next/navigation"
import { ConfirmArchiveButton } from "@/components/confirm-archive-button"
import { Alert } from "@/components/ui/alert"
import { buttonClasses } from "@/components/ui/button"
import { formatFcfa, monthYearLabel } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { archiveOwner, formatFeeRate, getOwnerProperties, getOwnerWithMonth } from "@/lib/owners"
import { getLandlordUnits } from "@/lib/units"

type OwnerDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  owner_created: "Propriétaire enregistré.",
  owner_updated: "Propriétaire mis à jour.",
}

function unitsLabel(units: number): string {
  if (units === 0) return "Aucun lot"
  return units === 1 ? "1 lot" : `${units} lots`
}

export default async function OwnerDetailPage({ params, searchParams }: OwnerDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const owner = await getOwnerWithMonth(landlord.id, id)

  if (!owner) notFound()

  const [properties, allUnits] = await Promise.all([
    getOwnerProperties(landlord.id, owner.id),
    getLandlordUnits(landlord.id),
  ])

  const notice =
    sp?.notice && Object.hasOwn(noticeLabels, sp.notice) ? noticeLabels[sp.notice] : null
  const month = monthYearLabel(new Date().toISOString().slice(0, 10))

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Détail du propriétaire</p>
        </div>
        <Link
          href="/owners"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Vos propriétaires
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        {notice ? <Alert variant="success">{notice}</Alert> : null}
        {sp?.error ? <Alert variant="error">{sp.error}</Alert> : null}

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-4xl">
            {owner.display_name}
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            {unitsLabel(owner.units)} · honoraires {formatFeeRate(owner.fee_rate_bp)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            {month ? `Mois de ${month}` : "Mois en cours"}
          </p>
          <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink-title">
            {formatFcfa(owner.net_due_to_owner)}
          </p>
          <p className="mt-1 text-sm text-foreground/70">À reverser</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Encaissé {formatFcfa(owner.collected)}</span>
            <span>Honoraires {formatFcfa(owner.fee)}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Téléphone</p>
            {owner.phone ? (
              <a
                href={`tel:${owner.phone}`}
                className="mt-3 block text-lg font-medium text-foreground underline-offset-4 hover:underline"
              >
                {owner.phone}
              </a>
            ) : (
              <p className="mt-3 text-lg font-medium text-foreground">Non renseigné</p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">E-mail</p>
            {owner.email ? (
              <a
                href={`mailto:${owner.email}`}
                className="mt-3 block truncate text-lg font-medium text-foreground underline-offset-4 hover:underline"
              >
                {owner.email}
              </a>
            ) : (
              <p className="mt-3 text-lg font-medium text-foreground">Non renseigné</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            Biens gérés
          </h2>
          {properties.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-foreground/70">
              Aucun bien rattaché. Ouvrez un bien et choisissez ce propriétaire dans « Géré pour le
              compte de ».
            </p>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => {
                const units = allUnits.filter((unit) => unit.property_id === property.id)

                return (
                  <Link
                    key={property.id}
                    href={`/properties/${property.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition hover:border-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{property.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[property.city, unitsLabel(units.length)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-primary underline-offset-4">
                      Voir
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Note</p>
          <p className="mt-3 text-base leading-7 text-foreground/70">
            {owner.notes ?? "Aucune note pour ce propriétaire."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/owners/${owner.id}/edit`} className={buttonClasses("primary")}>
            Modifier
          </Link>
        </div>

        <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm leading-6 text-foreground/80">
            ⓘ Archiver retire le propriétaire de vos listes, <strong>sans rien effacer</strong> :
            les biens, baux et quittances restent conservés dans le registre. Un propriétaire avec
            un bien rattaché ne peut pas être archivé : changez d&apos;abord le rattachement du
            bien.
          </p>
          <ConfirmArchiveButton
            id={owner.id}
            action={archiveOwner}
            label="Archiver ce propriétaire"
            confirmMessage="Archiver ce propriétaire ? Il quitte vos listes ; les biens, baux et quittances liés restent conservés dans le registre."
          />
        </div>
      </section>
    </main>
  )
}
