import { redirect } from "next/navigation"
import { BeninPhoneInput } from "@/components/benin-phone-input"
import { SubmitButton } from "@/components/submit-button"
import { AUTH_PATHS, getCurrentUser, toLocalPhone } from "@/lib/auth"
import { createLandlordProfile, getCurrentLandlord } from "@/lib/landlords"

type ProfilePageProps = {
  searchParams?: Promise<{
    error?: string
    missing?: string
  }>
}

const fullInputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const existing = await getCurrentLandlord()

  if (existing) {
    redirect(AUTH_PATHS.afterSignIn)
  }

  const currentUser = await getCurrentUser()
  const defaultPhone = currentUser?.phone ? toLocalPhone(currentUser.phone) : ""
  const params = await searchParams
  const errorMessage = params?.error
  const missingPhone = params?.missing === "phone"

  const labelClass = "block text-sm font-medium text-foreground"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Votre profil
            </h1>
            <p className="text-base leading-7 text-foreground/70">
              Ce numéro vous identifie et apparaîtra dans votre espace propriétaire.
            </p>
          </div>
        </div>

        {missingPhone ? (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-foreground">
            Ajoutez votre numéro pour activer votre espace propriétaire.
          </p>
        ) : null}

        <form action={createLandlordProfile} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>
              Numéro de téléphone <span className="text-red-700">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-border bg-background px-4 py-3 text-base text-foreground/70">
                🇧🇯 +229
              </span>
              <BeninPhoneInput
                id="phone"
                name="phone"
                defaultValue={defaultPhone}
                required
                className={phoneInputClass}
              />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Tapez les 10 chiffres : Ranti ajoute les espaces automatiquement.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>
              Prénom <span className="text-red-700">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              autoComplete="given-name"
              className={fullInputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>
              Nom <span className="text-red-700">*</span>
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              autoComplete="family-name"
              className={fullInputClass}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <SubmitButton
            className="w-full rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            Accéder à mon espace
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
