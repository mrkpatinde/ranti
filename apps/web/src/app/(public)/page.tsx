import Link from "next/link"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-10">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-neutral-50">
            L’espace simple pour suivre vos loyers.
          </h1>
          <p className="text-lg leading-8 text-neutral-600 dark:text-neutral-300">
            Vos biens, vos locataires, vos paiements et vos preuves réunis au même endroit.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/signup"
            className="block w-full rounded-xl bg-neutral-950 px-4 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Créer mon espace propriétaire
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-base font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
          >
            Se connecter
          </Link>
        </div>
      </section>
    </main>
  )
}
