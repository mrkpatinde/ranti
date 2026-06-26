import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { AUTH_PATHS } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
import { createClient } from "@/lib/supabase/server"

type VerifyLoginPageProps = {
  searchParams?: Promise<{
    phone?: string
    error?: string
  }>
}

function normalizeCode(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const code = value.trim().split(" ").join("")

  if (code.length !== 6) return null
  if ([...code].some((character) => character < "0" || character > "9")) return null

  return code
}

async function verifyLoginCode(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const code = normalizeCode(formData.get("code"))

  if (!phone || !code) {
    redirect(`/login/verify?error=${encodeURIComponent("Numéro ou code de vérification invalide.")}`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  })

  if (error) {
    redirect(`/login/verify?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent("Code invalide ou expiré.")}`)
  }

  revalidatePath("/", "layout")
  redirect(AUTH_PATHS.afterSignIn)
}

export default async function VerifyLoginPage({ searchParams }: VerifyLoginPageProps) {
  const params = await searchParams
  const phone = normalizePhone(params?.phone ?? null)
  const errorMessage = params?.error

  if (!phone) {
    redirect(AUTH_PATHS.signIn)
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
              Vérification
            </h1>
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Entrez le code reçu sur {phone}.
            </p>
          </div>
        </div>

        <form action={verifyLoginCode} className="space-y-5">
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

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Vérifier le code
          </button>

          <Link
            href={AUTH_PATHS.signIn}
            className="block text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            Utiliser un autre numéro
          </Link>
        </form>
      </section>
    </main>
  )
}
