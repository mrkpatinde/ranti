import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { createProperty } from "@/lib/properties"

type NewPropertyPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

const examples = ["Maison Akpakpa", "Immeuble Calavi", "Cour Fidjrossè", "Boutique centre-ville"]

export default async function NewPropertyPage({ searchParams }: NewPropertyPageProps) {
  await requireLandlordProfile()

  const params = await searchParams
  const errorMessage = params?.error

  const inputClass =
    "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
  const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Premier lieu
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Quel lieu voulez-vous suivre ?
          </h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Ajoutez seulement le premier endroit où vous encaissez un loyer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <span
              key={example}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"
            >
              {example}
            </span>
          ))}
        </div>

        <form action={createProperty} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className={labelClass}>
              Nom du lieu
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="organization"
              placeholder="Ex. Maison Akpakpa"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="city" className={labelClass}>
              Ville <span className="text-neutral-400">(optionnel)</span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              placeholder="Ex. Cotonou"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className={labelClass}>
              Adresse ou repère <span className="text-neutral-400">(optionnel)</span>
            </label>
            <input
              id="address"
              name="address"
              type="text"
              autoComplete="street-address"
              placeholder="Ex. quartier, rue ou repère simple"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Note <span className="text-neutral-400">(optionnel)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Ex. contient 3 logements"
              className={inputClass}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Créer ce lieu
          </button>
        </form>
      </section>
    </main>
  )
}
