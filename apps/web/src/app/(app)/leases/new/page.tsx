import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { createLease } from "@/lib/leases"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import { LeaseUnitFields } from "./lease-unit-fields"

type NewLeasePageProps = {
  searchParams?: Promise<{ error?: string; unit_id?: string; tenant_id?: string }>
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

function MissingPiece({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
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
      <section className="flex flex-1 flex-col justify-center gap-6 py-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
        <p className="text-base leading-7 text-foreground/70">{body}</p>
        <Link
          href={href}
          className="inline-flex w-fit rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          {cta}
        </Link>
      </section>
    </main>
  )
}

export default async function NewLeasePage({ searchParams }: NewLeasePageProps) {
  const landlord = await requireLandlordProfile()
  const [units, tenants] = await Promise.all([
    getLandlordUnits(landlord.id),
    getLandlordTenants(landlord.id),
  ])

  if (units.length === 0) {
    return (
      <MissingPiece
        title="Ajoutez d'abord un logement"
        body="Un bail relie un logement à un locataire. Créez un logement avant de continuer."
        href="/units/new"
        cta="Ajouter un logement"
      />
    )
  }
  if (tenants.length === 0) {
    return (
      <MissingPiece
        title="Ajoutez d'abord un locataire"
        body="Un bail relie un logement à un locataire. Créez un locataire avant de continuer."
        href="/tenants/new"
        cta="Ajouter un locataire"
      />
    )
  }

  const params = await searchParams
  const errorMessage = params?.error

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

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Créer un bail
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Le bail est créé en brouillon. Vous l&apos;activerez pour générer les échéances de loyer.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={createLease} className="space-y-5">
          <input type="hidden" name="currency" value="XOF" />

          <LeaseUnitFields
            units={units.map((u) => ({
              id: u.id,
              name: u.name,
              default_rent_amount: u.default_rent_amount,
              default_due_day: u.default_due_day,
            }))}
            defaultUnitId={params?.unit_id ?? units[0]?.id ?? ""}
          />

          <div className="space-y-2">
            <label htmlFor="tenant_id" className={labelClass}>
              Locataire <span className="text-red-700">*</span>
            </label>
            <select id="tenant_id" name="tenant_id" required defaultValue={params?.tenant_id ?? tenants[0]?.id} className={inputClass}>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.first_name} {tenant.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="start_date" className={labelClass}>
              Date de début <span className="text-red-700">*</span>
            </label>
            <input id="start_date" name="start_date" type="date" required className={inputClass} />
            <p className="text-sm leading-6 text-muted-foreground">ⓘ Les échéances mensuelles seront générées à partir de cette date, au jour d&apos;échéance choisi.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="end_date" className={labelClass}>
              Date de fin (optionnel)
            </label>
            <input id="end_date" name="end_date" type="date" className={inputClass} />
            <p className="text-sm leading-6 text-muted-foreground">ⓘ Optionnel. Sans date de fin, le bail court et les loyers se suivent mois après mois — le cas le plus courant.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Note (optionnel)
            </label>
            <textarea id="notes" name="notes" rows={3} placeholder="Information utile" className={inputClass} />
          </div>

          <SubmitButton
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            Créer le bail (brouillon)
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
