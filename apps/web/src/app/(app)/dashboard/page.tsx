import { isLocalAuthEnabled, requireAuth } from "@/lib/auth"

const dashboardSections = [
  {
    title: "Biens",
    description: "Ajouter et organiser les maisons ou immeubles à suivre.",
  },
  {
    title: "Locataires",
    description: "Associer chaque locataire à son logement.",
  },
  {
    title: "Loyers",
    description: "Suivre les paiements attendus et reçus.",
  },
  {
    title: "Retards",
    description: "Voir les loyers impayés et préparer les relances.",
  },
]

export default async function DashboardPage() {
  const claims = await requireAuth()
  const isLocalMode = isLocalAuthEnabled()
  const accountLabel = claims.phone ?? claims.email ?? "Compte Ranti"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <header className="flex flex-col gap-6 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Tableau de bord
            </h1>
            <p className="text-base text-neutral-600 dark:text-neutral-300">
              Le cahier de loyers moderne pour suivre paiements, retards et relances.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {accountLabel}
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      {isLocalMode ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Mode local actif. Le tableau de bord est accessible sans provider SMS pour continuer le développement.
        </section>
      ) : null}

      <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardSections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              À préparer
            </p>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {section.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-auto rounded-3xl border border-dashed border-neutral-300 p-8 dark:border-neutral-800">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
            Prochaine étape
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Créer le premier bien
          </h2>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            La prochaine brique ajoutera le modèle propriétaire / bien sans paiement, sans quittance et sans logique de relance.
          </p>
        </div>
      </section>
    </main>
  )
}
