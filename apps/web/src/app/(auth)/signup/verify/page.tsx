import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, resendSignupCode, verifyPhoneSignup } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
import { SubmitButton } from "@/components/submit-button"

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
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Vérifiez votre numéro
            </h1>
            <p className="text-base leading-7 text-foreground/70">
              Entrez le code envoyé par SMS au {phone}. Une seule fois, à l’inscription.
            </p>
          </div>
        </div>

        <form action={submitVerify} className="space-y-5">
          <input type="hidden" name="phone" value={phone} />

          <div className="space-y-2">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-foreground"
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
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {notice ? (
            <p className="rounded-xl border border-primary/15 bg-secondary px-4 py-3 text-sm text-foreground">
              {notice}
            </p>
          ) : null}

          <SubmitButton
            className="w-full rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            pendingLabel="Vérification…"
          >
            Vérifier
          </SubmitButton>
        </form>

        <form action={resendCode}>
          <input type="hidden" name="phone" value={phone} />
          <SubmitButton
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline disabled:opacity-60"
            pendingLabel="Envoi…"
          >
            Renvoyer le code
          </SubmitButton>
        </form>

        <Link
          href={AUTH_PATHS.signUp}
          className="block text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Utiliser un autre numéro
        </Link>
      </section>
    </main>
  )
}
