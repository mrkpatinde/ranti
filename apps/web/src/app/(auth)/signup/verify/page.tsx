import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, resendSignupCode, verifyPhoneSignup } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"

type VerifySignupPageProps = {
  searchParams?: Promise<{
    phone?: string
    error?: string
    notice?: string
  }>
}

async function submitVerify(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const result = await verifyPhoneSignup(formData)

  if (!result.ok) {
    redirect(
      `${AUTH_PATHS.signUpVerify}?phone=${encodeURIComponent(phone ?? "")}&error=${encodeURIComponent(result.message)}`
    )
  }

  redirect(AUTH_PATHS.profile)
}

async function resendCode(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const result = await resendSignupCode(formData)

  const params = new URLSearchParams()
  if (phone) params.set("phone", phone)
  params.set(result.ok ? "notice" : "error", result.ok ? "Nouveau code envoyé." : result.message)
  redirect(`${AUTH_PATHS.signUpVerify}?${params.toString()}`)
}

export default async function VerifySignupPage({ searchParams }: VerifySignupPageProps) {
  const params = await searchParams
  const phone = normalizePhone(params?.phone ?? null)
  const errorMessage = params?.error
  const notice = params?.notice

  if (!phone) {
    redirect(AUTH_PATHS.signUp)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Vérifiez votre numéro
            </h1>
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Entrez le code envoyé par SMS au {phone}. Une seule fois, à l’inscription.
            </p>
          </div>
        </div>

        <form action={submitVerify} className="space-y-5">
          <input type="hidden" name="phone" value={phone} />

          <div className="space-y-2">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-neutral-800 dark:text-neutral-100"
            >
              Code de vérification
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          {notice ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Vérifier
          </button>
        </form>

        <form action={resendCode}>
          <input type="hidden" name="phone" value={phone} />
          <button
            type="submit"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            Renvoyer le code
          </button>
        </form>

        <Link
          href={AUTH_PATHS.signUp}
          className="block text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          Utiliser un autre numéro
        </Link>
      </section>
    </main>
  )
}
