import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Connexion impossible
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Le lien est invalide, expiré ou déjà utilisé.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Retour à la connexion
        </Link>
      </section>
    </main>
  )
}
