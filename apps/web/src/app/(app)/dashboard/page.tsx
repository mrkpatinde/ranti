import { isLocalAuthEnabled, requireAuth } from "@/lib/auth"

const storySteps = [
  {
    eyebrow: "D’abord",
    title: "On note le lieu",
    description: "Commence par la maison, l’immeuble ou la cour que tu gères déjà dans ton cahier.",
  },
  {
    eyebrow: "Ensuite",
    title: "On ajoute les logements",
    description: "Ranti prépare l’espace pour chaque chambre, appartement, boutique ou logement.",
  },
  {
    eyebrow: "Puis",
    title: "On relie les locataires",
    description: "Chaque personne sera associée au bon logement, sans mélange et sans tableau compliqué.",
  },
  {
    eyebrow: "Enfin",
    title: "Ranti suit les loyers",
    description: "Paiements, retards, reçus et relances viendront naturellement après cette base.",
  },
]

export default async function DashboardPage() {
  const claims = await requireAuth()
  const isLocalMode = isLocalAuthEnabled()
  const accountLabel = claims.phone ?? claims.email ?? "Compte Ranti"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {accountLabel}
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
          Mode local actif. Tu peux construire le produit sans provider SMS.
        </section>
      ) : null}

      <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-neutral-500">
              On commence doucement
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
              Recréons ton cahier de loyers, une étape après l’autre.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-neutral-600 dark:text-neutral-300">
              Pas besoin de tout remplir maintenant. Ranti va d’abord comprendre ce que tu gères, puis il t’aidera à suivre qui a payé, qui doit, et qui relancer.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Première chose à faire
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Ajouter ton premier bien
            </h2>
            <p className="mt-3 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Une maison, un immeuble, une cour ou quelques logements. On part de ce que tu connais déjà.
            </p>
            <button
              type="button"
              disabled
              className="mt-6 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white opacity-60 dark:bg-neutral-50 dark:text-neutral-950"
            >
              Ajouter mon premier bien bientôt
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {storySteps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    {step.eyebrow}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {step.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
