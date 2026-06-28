import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { createLease } from "@/lib/leases"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

type NewLeasePageProps = {
  searchParams?: Promise<{ error?: string; unit_id?: string; tenant_id?: string }>
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

function MissingPiece({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Nouveau bail</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Retour
        </Link>
      </header>
      <section className="flex flex-1 flex-col justify-center gap-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{title}</h1>
        <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">{body}</p>
        <Link
          href={href}
          className="inline-flex w-fit rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
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
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Nouveau bail</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Créer un bail
          </h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Le bail est créé en brouillon. Vous l&apos;activerez pour générer les échéances de loyer.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errorMessage}
          </p>
        ) : null}

        <form action={createLease} className="space-y-5">
          <input type="hidden" name="currency" value="XOF" />

          <div className="space-y-2">
            <label htmlFor="unit_id" className={labelClass}>
              Logement
            </label>
            <select id="unit_id" name="unit_id" required defaultValue={params?.unit_id ?? units[0]?.id} className={inputClass}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="tenant_id" className={labelClass}>
              Locataire
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
            <label htmlFor="monthly_rent_amount" className={labelClass}>
              Loyer mensuel (FCFA)
            </label>
            <input
              id="monthly_rent_amount"
              name="monthly_rent_amount"
              type="text"
              inputMode="numeric"
              required
              placeholder="Ex. 50000"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="due_day" className={labelClass}>
              Jour d&apos;échéance (1 à 31)
            </label>
            <input
              id="due_day"
              name="due_day"
              type="number"
              min={1}
              max={31}
              required
              placeholder="Ex. 5"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="start_date" className={labelClass}>
              Date de début
            </label>
            <input id="start_date" name="start_date" type="date" required className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="end_date" className={labelClass}>
              Date de fin (optionnel)
            </label>
            <input id="end_date" name="end_date" type="date" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Note (optionnel)
            </label>
            <textarea id="notes" name="notes" rows={3} placeholder="Information utile" className={inputClass} />
          </div>

          <SubmitButton
            className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Créer le bail (brouillon)
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
