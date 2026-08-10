import { redirect } from "next/navigation"
import { AUTH_PATHS, getCurrentUser } from "@/lib/auth"
import {
  DEFAULT_COUNTRY_CODE,
  countryForPhone,
  toCountryLocalPhone,
} from "@/lib/auth/countries"
import { getCurrentLandlord } from "@/lib/landlords"
import { ProfileForm } from "./profile-form"

// Profil d'onboarding : bifurcation explicite « entreprise de gestion » /
// « nom propre » (retour fondateur 2026-08-10), formulaire dans ProfileForm.
// Le shell est masqué sur cet écran : le lien de déconnexion en bas est la
// seule issue d'une session qui n'est pas la bonne.

type ProfilePageProps = {
  searchParams?: Promise<{
    error?: string
    missing?: string
  }>
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const existing = await getCurrentLandlord()

  if (existing) {
    redirect(AUTH_PATHS.afterSignIn)
  }

  const currentUser = await getCurrentUser()
  // Legacy phone-auth accounts carry a verified number: preselect its country
  // and prefill the local part. Google-only signups start on the default.
  const knownCountry = countryForPhone(currentUser?.phone)
  const defaultPhone =
    knownCountry && currentUser?.phone
      ? toCountryLocalPhone(knownCountry, currentUser.phone)
      : ""
  const params = await searchParams
  const errorMessage = params?.error
  const missingPhone = params?.missing === "phone"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground">
              Votre profil
            </h1>
            <p className="text-base leading-7 text-foreground/70">
              Une question pour commencer : Ranti adapte vos documents.
            </p>
          </div>
        </div>

        {missingPhone ? (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
            Ajoutez votre numéro pour activer votre espace propriétaire.
          </p>
        ) : null}

        <ProfileForm
          defaultCountryCode={knownCountry?.code ?? DEFAULT_COUNTRY_CODE}
          defaultPhone={defaultPhone}
          errorMessage={errorMessage}
        />

        {/* Session fantôme : le shell (et son bouton de déconnexion) est
            masqué sur cet écran — ce lien discret est la seule porte de
            sortie. Même POST que le bouton du shell. */}
        <form action="/auth/signout" method="post" className="text-center">
          <button
            type="submit"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Ce n&apos;est pas vous ? Se déconnecter
          </button>
        </form>
      </section>
    </main>
  )
}
