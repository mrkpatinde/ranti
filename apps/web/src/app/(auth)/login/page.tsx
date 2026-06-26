import { redirect } from "next/navigation"
import { AUTH_PATHS, signInWithPhoneOtp } from "@/lib/auth"

type LoginPageProps = {
  searchParams?: Promise<{
    sent?: string
    error?: string
  }>
}

async function requestLoginCode(formData: FormData) {
  "use server"

  const result = await signInWithPhoneOtp(formData)

  if (!result.ok) {
    redirect(`${AUTH_PATHS.signIn}?error=${encodeURIComponent(result.message)}`)
  }

  redirect(`${AUTH_PATHS.signIn}?sent=1`)
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const hasSentLoginCode = params?.sent === "1"
  const errorMessage = params?.error

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Connexion
            </h1>
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Connectez-vous pour accéder à votre tableau de bord Ranti.
            </p>
          </div>
        </div>

        <form action={requestLoginCode} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-neutral-800 dark:text-neutral-100"
            >
              Numéro de téléphone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="+229..."
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          {hasSentLoginCode ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              Code envoyé. Vérifiez votre téléphone.
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Recevoir le code de connexion
          </button>

          <p className="text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            Nous vous enverrons un code sécurisé sur votre numéro de téléphone.
          </p>
        </form>
      </section>
    </main>
  )
}
