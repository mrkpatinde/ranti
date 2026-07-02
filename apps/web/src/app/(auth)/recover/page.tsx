import Link from "next/link"
import { redirect } from "next/navigation"
import { AUTH_PATHS, completeRecovery, requestRecoveryCode } from "@/lib/auth"
import { normalizePhone } from "@/lib/auth/validation"
import { SubmitButton } from "@/components/submit-button"
import { PasswordField } from "../password-field"
import { PhoneField } from "../phone-field"

type RecoverPageProps = {
  searchParams?: Promise<{
    phone?: string
    sent?: string
    error?: string
  }>
}

async function submitRequest(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const result = await requestRecoveryCode(formData)

  if (!result.ok) {
    const params = new URLSearchParams({ error: result.message })
    if (phone) params.set("phone", phone)
    redirect(`${AUTH_PATHS.recover}?${params.toString()}`)
  }

  redirect(`${AUTH_PATHS.recover}?phone=${encodeURIComponent(phone ?? "")}&sent=1`)
}

async function submitComplete(formData: FormData) {
  "use server"

  const phone = normalizePhone(formData.get("phone"))
  const result = await completeRecovery(formData)

  if (!result.ok) {
    redirect(
      `${AUTH_PATHS.recover}?phone=${encodeURIComponent(phone ?? "")}&sent=1&error=${encodeURIComponent(result.message)}`
    )
  }

  redirect(AUTH_PATHS.afterSignIn)
}

export default async function RecoverPage({ searchParams }: RecoverPageProps) {
  const params = await searchParams
  const phone = params?.phone ?? ""
  const sent = params?.sent === "1"
  const errorMessage = params?.error

  const inputClass =
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
  const labelClass = "block text-sm font-medium text-foreground"
  const buttonClass =
    "w-full rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Mot de passe oublié
            </h1>
            <p className="text-base leading-7 text-foreground/70">
              {sent
                ? `Entrez le code reçu par SMS au ${phone} et choisissez un nouveau mot de passe.`
                : "Indiquez votre numéro pour recevoir un code par SMS."}
            </p>
          </div>
        </div>

        {sent ? (
          <form action={submitComplete} className="space-y-5">
            <input type="hidden" name="phone" value={phone} />
            <div className="space-y-2">
              <label htmlFor="code" className={labelClass}>
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
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className={labelClass}>
                Nouveau mot de passe
              </label>
              <PasswordField
                autoComplete="new-password"
                minLength={8}
                placeholder="Au moins 8 caractères"
                inputClassName={inputClass}
              />
            </div>

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <SubmitButton className={buttonClass} pendingLabel="Patientez…">
              Mettre à jour mon mot de passe
            </SubmitButton>
          </form>
        ) : (
          <form action={submitRequest} className="space-y-5">
            <PhoneField defaultValue={phone} labelClassName={labelClass} />

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <SubmitButton className={buttonClass} pendingLabel="Envoi…">
              Recevoir un code
            </SubmitButton>
          </form>
        )}

        <Link
          href={AUTH_PATHS.signIn}
          className="block text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </section>
    </main>
  )
}
