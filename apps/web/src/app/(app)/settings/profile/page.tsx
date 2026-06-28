import Link from "next/link"
import { BeninPhoneInput } from "@/components/benin-phone-input"
import { SubmitButton } from "@/components/submit-button"
import { toLocalPhone } from "@/lib/auth"
import { requireLandlordProfile, updateLandlordProfile } from "@/lib/landlords"

type ProfileSettingsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const CIVILITY_OPTIONS = [
  { value: "mr", label: "Monsieur" },
  { value: "mrs", label: "Madame" },
  { value: "miss", label: "Mademoiselle" },
  { value: "not_specified", label: "Préférer ne pas dire" },
] as const

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

const noticeLabels: Record<string, string> = {
  profile_updated: "Profil propriétaire mis à jour.",
}

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const notice = params?.notice ? noticeLabels[params.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Profil propriétaire</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Modifier mon profil
          </h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Ces informations apparaissent dans votre espace et sur vos documents de paiement.
          </p>
        </div>

        {notice ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {notice}
          </p>
        ) : null}

        {params?.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {params.error}
          </p>
        ) : null}

        <form action={updateLandlordProfile} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className={labelClass}>Civilité</legend>
            <div className="flex flex-wrap gap-2">
              {CIVILITY_OPTIONS.map((option) => (
                <label key={option.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="civility"
                    value={option.value}
                    defaultChecked={(landlord.civility ?? "not_specified") === option.value}
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
            <label htmlFor="phone" className={labelClass}>Numéro de téléphone</label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                🇧🇯 +229
              </span>
              <BeninPhoneInput id="phone" name="phone" defaultValue={toLocalPhone(landlord.phone)} required className={phoneInputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>Prénom</label>
            <input id="first_name" name="first_name" type="text" required defaultValue={landlord.first_name} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>Nom</label>
            <input id="last_name" name="last_name" type="text" required defaultValue={landlord.last_name} className={inputClass} />
          </div>

          <SubmitButton className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">
            Enregistrer les modifications
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
