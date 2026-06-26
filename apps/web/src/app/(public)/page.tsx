import Link from "next/link"

const monthlyChecks = [
  "Qui a payé ce mois-ci ?",
  "Qui reste en retard ?",
  "Quelle preuve existe ?",
  "Quel reçu doit être gardé ?",
]

const fieldRealities = [
  "Paiements en espèces, Mobile Money ou virement.",
  "Échanges simples avec les locataires.",
  "Preuves de paiement faciles à retrouver.",
]

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 text-neutral-950 dark:text-neutral-50">
      <header className="flex items-center justify-between py-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
          Ranti
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-neutral-600 transition hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-50"
        >
          Se connecter
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div className="space-y-8">
          <div className="space-y-5">
            <p className="text-sm font-medium text-neutral-500">
              Pour propriétaires africains de 1 à 20 logements
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Suivez vos loyers sans perdre la relation avec vos locataires.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-neutral-600 dark:text-neutral-300">
              Ranti vous aide à savoir qui a payé, qui reste dû et quelle preuve existe, avant toute relance.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:max-w-md sm:flex-row">
            <Link
              href="/signup"
              className="rounded-xl bg-neutral-950 px-5 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Ouvrir mon espace propriétaire
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-neutral-300 px-5 py-3 text-center text-base font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
            >
              J’ai déjà un espace
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900">
            <p className="text-sm font-medium text-neutral-500">Ce mois-ci</p>
            <div className="mt-5 space-y-3">
              {monthlyChecks.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-800 dark:border-neutral-800 dark:text-neutral-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-neutral-200 py-10 dark:border-neutral-800 md:grid-cols-3">
        {fieldRealities.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
              {item}
            </p>
          </div>
        ))}
      </section>
    </main>
  )
}
