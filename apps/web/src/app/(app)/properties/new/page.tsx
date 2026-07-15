import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
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
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
  const labelClass = "block text-sm font-medium text-foreground"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Ranti
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Premier lieu
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Quel lieu voulez-vous suivre ?
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Ajoutez seulement le premier endroit où vous encaissez un loyer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <span
              key={example}
              className="rounded-full border border-border px-3 py-1 text-sm text-foreground/70"
            >
              {example}
            </span>
          ))}
        </div>

        <form action={createProperty} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className={labelClass}>
              Nom du lieu <span className="text-red-700">*</span>
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
              Ville <span className="text-muted-foreground">(optionnel)</span>
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
              Adresse ou repère <span className="text-muted-foreground">(optionnel)</span>
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
              Note <span className="text-muted-foreground">(optionnel)</span>
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
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <SubmitButton
            className="w-full rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            Créer ce lieu
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
