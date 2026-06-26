import { redirect } from "next/navigation"
import { isLocalAuthEnabled, requireAuth } from "@/lib/auth"

type WelcomePageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

function normalizeDisplayName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null

  const name = value.trim().replaceAll("  ", " ")

  if (name.length < 2) return null
  if (name.length > 80) return null

  return name
}

async function continueWithName(formData: FormData) {
  "use server"

  const displayName = normalizeDisplayName(formData.get("displayName"))

  if (!displayName) {
    redirect(`/welcome?error=${encodeURIComponent("Dites-nous simplement comment vous appeler.")}`)
  }

  redirect(`/onboarding/property?name=${encodeURIComponent(displayName)}`)
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams
  const errorMessage = params?.error
  const claims = await requireAuth()
  const isLocalMode = isLocalAuthEnabled()
  const accountLabel = claims.phone ?? claims.email ?? "Compte Ranti"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {accountLabel}
          </p>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      {isLocalMode ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Mode local actif. Ce parcours sert à construire le produit sans provider SMS.
        </section>
      ) : null}

      <section className="flex flex-1 items-center py-12">
        <div className="w-full space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-neutral-500">
              Bienvenue !
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
              Comment devons-nous vous appeler ?
            </h1>
            <p className="max-w-xl text-lg leading-8 text-neutral-600 dark:text-neutral-300">
              On va créer votre cahier de loyers pas à pas. D’abord votre nom, puis le premier lieu que vous voulez suivre.
            </p>
          </div>

          <form action={continueWithName} className="space-y-5 rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="space-y-2">
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-neutral-800 dark:text-neutral-100"
              >
                Votre nom
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                autoComplete="name"
                placeholder="Ex. Monsieur Koffi"
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
              Continuer
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
