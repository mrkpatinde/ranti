export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Tableau de bord
          </h1>
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

      <section className="flex flex-1 items-center py-16">
        <div className="space-y-4">
          <p className="text-base text-neutral-600 dark:text-neutral-300">
            Bienvenue sur Ranti.
          </p>
          <p className="max-w-xl text-2xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-neutral-50">
            Le suivi des loyers arrive ici.
          </p>
        </div>
      </section>
    </main>
  )
}
