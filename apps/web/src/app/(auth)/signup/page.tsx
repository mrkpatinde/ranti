import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, signInWithGoogle, signUpWithPhonePassword } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
import { SubmitButton } from "@/components/submit-button"
import { PasswordField } from "../password-field"
import { PhoneField } from "../phone-field"
import { CountrySignupGate } from "./country-signup-gate"

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
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Créer votre espace
            </h1>
            <p className="text-base leading-7 text-foreground/70">
              Choisissez votre pays pour commencer.
            </p>
          </div>
        </div>

        <CountrySignupGate
          phoneSignup={
            /* Phone + password is the primary path in Benin — Google is secondary below. */
            <form action={submitSignup} className="space-y-5">
              <PhoneField
                defaultValue={phone}
                labelClassName="block text-sm font-medium text-foreground"
              />

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  Mot de passe
                </label>
                <PasswordField
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Au moins 8 caractères"
                  inputClassName="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
                />
              </div>

              {errorMessage ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <SubmitButton
                className="w-full rounded-full bg-accent px-4 py-3 text-base font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(242,163,60,0.55)] transition hover:brightness-95 disabled:opacity-60"
                pendingLabel="Création…"
              >
                Continuer
              </SubmitButton>
            </form>
          }
          googleSignup={
            /* Google OAuth — secondary in Benin, the only signup path in Senegal and Côte d'Ivoire. */
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-base font-medium text-foreground/80 transition hover:bg-secondary/60"
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
          }
        />

        <p className="text-sm leading-6 text-muted-foreground">
          En créant votre espace, vous acceptez nos{" "}
          <Link href="/conditions" className="underline underline-offset-4 hover:text-foreground">conditions d&apos;utilisation</Link>{" "}
          et notre{" "}
          <Link href="/confidentialite" className="underline underline-offset-4 hover:text-foreground">politique de confidentialité</Link>.
        </p>

        <Link
          href={AUTH_PATHS.signIn}
          className="block text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          J&apos;ai déjà un espace
        </Link>
      </section>
    </main>
  )
}
