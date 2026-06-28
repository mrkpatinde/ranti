import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, signInWithGoogle, signInWithPhonePassword } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
import { SubmitButton } from "@/components/submit-button"
import { PasswordField } from "../password-field"
import { PhoneField } from "../phone-field"

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
    phone?: string
  }>
}

async function submitLogin(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const result = await signInWithPhonePassword(formData)

  if (!result.ok) {
    const params = new URLSearchParams({ error: result.message })
    if (phone) params.set("phone", phone)
    redirect(`${AUTH_PATHS.signIn}?${params.toString()}`)
  }

  redirect(AUTH_PATHS.afterSignIn)
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const errorMessage = params?.error
  const phone = params?.phone ?? ""

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Se connecter
            </h1>
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Accédez au suivi de vos loyers.
            </p>
          </div>
        </div>

        {/* Google OAuth — SEPARATE form, not nested */}
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
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

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          <span className="text-xs text-neutral-400 dark:text-neutral-500">ou</span>
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        </div>

        {/* Phone login — separate form */}
        <form action={submitLogin} className="space-y-5">
          <PhoneField
            defaultValue={phone}
            labelClassName="block text-sm font-medium text-neutral-800 dark:text-neutral-100"
          />

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-800 dark:text-neutral-100"
            >
              Mot de passe
            </label>
            <PasswordField
              autoComplete="current-password"
              inputClassName="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          <SubmitButton
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
            pendingLabel="Connexion…"
          >
            Se connecter
          </SubmitButton>

          <div className="flex items-center justify-between">
            <Link
              href={AUTH_PATHS.recover}
              className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
            >
              Mot de passe oublié
            </Link>
            <Link
              href={AUTH_PATHS.signUp}
              className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
            >
              Créer un espace
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}
