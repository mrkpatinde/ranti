import Link from "next/link"
import { Alert } from "@/components/ui/alert"
import { buttonClasses } from "@/components/ui/button"
import { formatFcfa, monthYearLabel } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { formatFeeRate, getOwnersWithMonth } from "@/lib/owners"

type OwnersPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  owner_archived: "Propriétaire archivé.",
}

function unitsLabel(units: number): string {
  if (units === 0) return "Aucun lot"
  return units === 1 ? "1 lot" : `${units} lots`
}

export default async function OwnersPage({ searchParams }: OwnersPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const owners = await getOwnersWithMonth(landlord.id)

  // Object.hasOwn : un ?notice forgé ne doit pas renvoyer Object.prototype.
  const notice =
    params?.notice && Object.hasOwn(noticeLabels, params.notice) ? noticeLabels[params.notice] : null

  const month = monthYearLabel(new Date().toISOString().slice(0, 10))
  const collected = owners.reduce((total, owner) => total + owner.collected, 0)
  const fee = owners.reduce((total, owner) => total + owner.fee, 0)
  const netDue = owners.reduce((total, owner) => total + owner.net_due_to_owner, 0)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Propriétaires</p>
        </div>
        <Link
          href="/import"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Importer
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-4xl">
            Les propriétaires que vous gérez
          </h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">
            Pour chacun : ses lots, vos honoraires, et ce qui lui revient sur le mois.
          </p>
        </div>

        {notice ? <Alert variant="success">{notice}</Alert> : null}
        {params?.error ? <Alert variant="error">{params.error}</Alert> : null}

        {owners.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Aucun propriétaire pour le moment
            </h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Chargez votre portefeuille : les propriétaires, leurs biens et leurs lots sont créés
              à partir du fichier.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/import" className={buttonClasses("primary")}>
                Importer un fichier
              </Link>
              <Link href="/owners/new" className={buttonClasses("secondary")}>
                Ajouter un propriétaire
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-medium text-muted-foreground">
                {month ? `Mois de ${month}` : "Mois en cours"}
              </p>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink-title">
                {formatFcfa(netDue)}
              </p>
              <p className="mt-1 text-sm text-foreground/70">À reverser aux propriétaires</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>Encaissé {formatFcfa(collected)}</span>
                <span>Honoraires {formatFcfa(fee)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {owners.map((owner) => (
                <Link
                  key={owner.id}
                  href={`/owners/${owner.id}`}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition hover:border-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{owner.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {unitsLabel(owner.units)} · {formatFeeRate(owner.fee_rate_bp)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium text-foreground">
                      {formatFcfa(owner.net_due_to_owner)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      encaissé {formatFcfa(owner.collected)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/owners/new" className={buttonClasses("secondary")}>
                Ajouter un propriétaire
              </Link>
              <Link href="/import" className={buttonClasses("secondary")}>
                Importer un fichier
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
