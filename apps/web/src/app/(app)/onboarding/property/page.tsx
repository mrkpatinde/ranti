import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"

type PropertyOnboardingPageProps = {
  searchParams?: Promise<{
    name?: string
  }>
}

export default async function PropertyOnboardingPage({ searchParams }: PropertyOnboardingPageProps) {
  await requireAuth()

  const params = await searchParams
  const displayName = params?.name?.trim()

  if (!displayName) {
    redirect("/welcome")
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <header className="border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
          Ranti
        </p>
      </header>

      <section className="flex flex-1 items-center py-12">
        <div className="w-full space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-neutral-500">
              Bienvenue, {displayName}.
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
              Quel est le premier lieu que vous voulez suivre ?
            </h1>
            <p className="max-w-xl text-lg leading-8 text-neutral-600 dark:text-neutral-300">
              Une maison, un immeuble, une cour, une boutique ou quelques logements. On part simplement de votre cahier actuel.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Cette étape arrive juste après.
            </p>
            <p className="mt-3 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              La prochaine brique enregistrera ce premier lieu, puis Ranti demandera les logements un par un.
            </p>
            <Link
              href="/welcome"
              className="mt-6 inline-block text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200"
            >
              Revenir au nom
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
