import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, signInWithPhonePassword } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
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
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Se connecter
          </button>

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
