import { redirect } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { AUTH_PATHS, getCurrentUser, toLocalPhone } from "@/lib/auth"
import { createLandlordProfile, getCurrentLandlord } from "@/lib/landlords"

type ProfilePageProps = {
  searchParams?: Promise<{
    error?: string
    missing?: string
  }>
}

const CIVILITY_OPTIONS = [
  { value: "mr", label: "Monsieur" },
  { value: "mrs", label: "Madame" },
  { value: "miss", label: "Mademoiselle" },
  { value: "not_specified", label: "Préférer ne pas dire" },
] as const

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

  const inputClass =
    "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
  const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Votre profil
            </h1>
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Utilisé sur vos quittances et dans votre espace.
            </p>
          </div>
        </div>

        {missingPhone ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Ajoutez votre numéro pour activer les rappels et terminer votre profil.
          </p>
        ) : null}

        <form action={createLandlordProfile} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className={labelClass}>Civilité</legend>
            <div className="flex flex-wrap gap-2">
              {CIVILITY_OPTIONS.map((option) => (
                <label key={option.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="civility"
                    value={option.value}
                    defaultChecked={option.value === "not_specified"}
                    className="peer sr-only"
                  />
                  <span className="block rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 transition peer-checked:border-neutral-950 peer-checked:bg-neutral-950 peer-checked:text-white dark:border-neutral-700 dark:text-neutral-100 dark:peer-checked:border-neutral-50 dark:peer-checked:bg-neutral-50 dark:peer-checked:text-neutral-950">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>
              Numéro de téléphone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              defaultValue={defaultPhone}
              placeholder="01 90 00 00 00"
              className={inputClass}
            />
            <p className="text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              Ranti l’utilise pour les rappels WhatsApp et le suivi de vos loyers.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>
              Prénom
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              autoComplete="given-name"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>
              Nom
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              autoComplete="family-name"
              className={inputClass}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          <SubmitButton
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Accéder à mon espace
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
