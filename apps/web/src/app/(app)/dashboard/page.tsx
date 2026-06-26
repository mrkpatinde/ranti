import { isLocalAuthEnabled } from "@/lib/auth"
import { requireLandlordProfile } from "@/lib/landlords"

const setupSteps = [
  { label: "Bien", done: false },
  { label: "Logement", done: false },
  { label: "Locataire", done: false },
  { label: "Bail", done: false },
  { label: "Loyers", done: false },
]

export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const isLocalMode = isLocalAuthEnabled()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {landlord.first_name} {landlord.last_name}
          </p>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      {isLocalMode ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Mode local actif. Développement sans provider SMS.
        </section>
      ) : null}

      <section className="flex flex-1 flex-col justify-center gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
            Bonjour {landlord.first_name}.
          </h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Pour suivre vos loyers, ajoutez un bien, un logement et un locataire,
            puis créez le bail. Ranti génère ensuite les échéances.
          </p>
        </div>

        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {setupSteps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2">
              <span className="rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                {step.label}
              </span>
              {index < setupSteps.length - 1 ? (
                <span aria-hidden className="text-neutral-400">→</span>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Première étape : ajouter un bien
          </h2>
          <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Une maison, un immeuble, une cour ou une boutique.
          </p>
          <button
            type="button"
            disabled
            className="mt-5 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white opacity-60 dark:bg-neutral-50 dark:text-neutral-950"
          >
            Ajouter un bien (bientôt)
          </button>
        </div>
      </section>
    </main>
  )
}
