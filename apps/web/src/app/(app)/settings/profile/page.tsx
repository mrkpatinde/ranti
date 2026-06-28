import Link from "next/link"
import { toLocalPhone } from "@/lib/auth"
import { requireLandlordProfile } from "@/lib/landlords"

type ProfileSettingsPageProps = {
  searchParams?: Promise<{ error?: string }>
}

const civilityLabels: Record<string, string> = {
  mr: "Monsieur",
  mrs: "Madame",
  miss: "Mademoiselle",
  not_specified: "Non renseignée",
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <p className="mt-1 text-base font-medium text-neutral-950 dark:text-neutral-50">{value}</p>
    </div>
  )
}

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const civility = civilityLabels[landlord.civility ?? "not_specified"] ?? "Non renseignée"

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

      <section className="flex flex-1 flex-col gap-6 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Identité du propriétaire</h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Ces informations apparaissent dans le registre, les reçus et les quittances. Elles sont verrouillées pour éviter les changements incohérents.
          </p>
        </div>

        {params?.error ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {params.error}
          </p>
        ) : null}

        <div className="space-y-3">
          <ProfileRow label="Civilité" value={civility} />
          <ProfileRow label="Prénom" value={landlord.first_name} />
          <ProfileRow label="Nom" value={landlord.last_name} />
          <ProfileRow label="Téléphone" value={`+229 ${toLocalPhone(landlord.phone)}`} />
        </div>

        <p className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          Pour corriger ces informations plus tard, Ranti devra passer par une vérification et garder une trace du changement.
        </p>
      </section>
    </main>
  )
}
