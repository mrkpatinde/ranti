import Link from "next/link"
import { AUTH_PATHS, signInWithGoogle } from "@/lib/auth"

// Auth Google-only (temporaire). Les chemins téléphone/mot de passe sont gelés
// (code conservé dans lib/auth + composants, non exposés). Voir BUILD_STATUS.

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const errorMessage = params?.error

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Se connecter
            </h1>
            <p className="text-base leading-7 text-foreground/70">
              Accédez au suivi de vos loyers.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-base font-medium text-foreground transition hover:bg-secondary/60"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>
        </form>

        <Link
          href={AUTH_PATHS.signUp}
          className="block text-center text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Créer un espace
        </Link>
      </section>
    </main>
  )
}
