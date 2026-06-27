import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, signUpWithPhonePassword } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
import { PasswordField } from "../password-field"
import { PhoneField } from "../phone-field"

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string
    phone?: string
  }>
}

async function submitSignup(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const result = await signUpWithPhonePassword(formData)

  if (!result.ok) {
    if (result.code === "user_already_exists" && phone) {
      redirect(
        `${AUTH_PATHS.signIn}?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent(result.message)}`
      )
    }

    const params = new URLSearchParams({ error: result.message })
    if (phone) params.set("phone", phone)
    redirect(`${AUTH_PATHS.signUp}?${params.toString()}`)
  }

  redirect(`${AUTH_PATHS.signUpVerify}?phone=${encodeURIComponent(phone ?? "")}`)
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
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
              Créer votre espace
            </h1>
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Votre numéro et un mot de passe suffisent.
            </p>
          </div>
        </div>

        <form action={submitSignup} className="space-y-5">
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
              autoComplete="new-password"
              minLength={8}
              placeholder="Au moins 8 caractères"
              inputClassName="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
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
            Continuer
          </button>

          <Link
            href={AUTH_PATHS.signIn}
            className="block text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            J’ai déjà un espace
          </Link>
        </form>
      </section>
    </main>
  )
}
