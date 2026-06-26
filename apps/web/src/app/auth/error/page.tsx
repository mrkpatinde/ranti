import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Connexion impossible
          </h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Le lien est invalide, expiré ou déjà utilisé.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          Retour à la connexion
        </Link>
      </section>
    </main>
  )
}
