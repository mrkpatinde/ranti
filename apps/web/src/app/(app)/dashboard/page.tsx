import Link from "next/link"
import { isLocalAuthEnabled } from "@/lib/auth"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordProperties } from "@/lib/properties"
import { getLandlordRentDues } from "@/lib/rent-dues"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

const unitTypeLabels: Record<string, string> = {
  house: "Maison",
  apartment: "Appartement",
  room: "Chambre",
  shop: "Boutique",
  store: "Magasin",
  office: "Bureau",
  warehouse: "Entrepôt",
  other: "Autre",
}

function buildSetupSteps(
  hasProperties: boolean,
  hasUnits: boolean,
  hasTenants: boolean,
  hasLeases: boolean,
  hasActiveLease: boolean
) {
  return [
    { label: "Bien", done: hasProperties },
    { label: "Logement", done: hasUnits },
    { label: "Locataire", done: hasTenants },
    { label: "Bail", done: hasLeases },
    { label: "Loyers", done: hasActiveLease },
  ]
}

export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const [properties, units, tenants, leases, dues] = await Promise.all([
    getLandlordProperties(landlord.id),
    getLandlordUnits(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordLeases(landlord.id),
    getLandlordRentDues(landlord.id),
  ])
  const hasProperties = properties.length > 0
  const hasUnits = units.length > 0
  const hasTenants = tenants.length > 0
  const hasLeases = leases.length > 0
  const hasActiveLease = leases.some((lease) => lease.status === "active")
  const setupSteps = buildSetupSteps(hasProperties, hasUnits, hasTenants, hasLeases, hasActiveLease)
  const isLocalMode = isLocalAuthEnabled()

  // Monthly rent synthesis: the three MVP questions — who paid, who is late, what to do.
  const unitName = (id: string): string => units.find((u) => u.id === id)?.name ?? "Logement"
  const tenantName = (id: string): string => {
    const t = tenants.find((x) => x.id === id)
    return t ? `${t.first_name} ${t.last_name}` : "Locataire"
  }
  const overdue = dues.filter((d) => d.status === "overdue")
  const expected = dues.filter((d) => d.status === "expected")
  const paid = dues.filter((d) => d.status === "paid")
  const sum = (list: typeof dues): number => list.reduce((total, d) => total + d.amount_due, 0)
  // Action list: late first, then upcoming, soonest due date first.
  const actionDues = [...overdue, ...expected].sort((a, b) => a.due_date.localeCompare(b.due_date))

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {landlord.first_name} {landlord.last_name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/tenants"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            Locataires
          </Link>
          <Link
            href="/leases"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            Baux
          </Link>
          <Link
            href="/collections"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            Encaissements
          </Link>
          <Link
            href="/receipts"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            Quittances
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      {isLocalMode ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Mode local actif. Développement sans provider SMS.
        </section>
      ) : null}

      <section className="flex flex-1 flex-col justify-center gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
            Bonjour {landlord.first_name}.
          </h1>
          <p className="max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
            Votre registre de loyer commence par les lieux et les logements que vous voulez suivre.
            Ensuite, vous ajouterez les locataires et les baux.
          </p>
        </div>

        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {setupSteps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2">
              <span
                className={
                  step.done
                    ? "rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950"
                    : "rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                }
              >
                {step.done ? "✓ " : ""}{step.label}
              </span>
              {index < setupSteps.length - 1 ? (
                <span aria-hidden className="text-neutral-400">→</span>
              ) : null}
            </li>
          ))}
        </ol>

        {hasActiveLease ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                <p className="text-sm text-red-900 dark:text-red-100">En retard</p>
                <p className="mt-1 text-2xl font-semibold text-red-950 dark:text-red-50">{formatAmount(sum(overdue))}</p>
                <p className="text-sm text-red-800 dark:text-red-200">{overdue.length} échéance{overdue.length > 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-sm text-amber-900 dark:text-amber-100">Attendu</p>
                <p className="mt-1 text-2xl font-semibold text-amber-950 dark:text-amber-50">{formatAmount(sum(expected))}</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">{expected.length} échéance{expected.length > 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
                <p className="text-sm text-emerald-900 dark:text-emerald-100">Payé</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-950 dark:text-emerald-50">{formatAmount(sum(paid))}</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">{paid.length} échéance{paid.length > 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                À encaisser
              </h2>
              {actionDues.length === 0 ? (
                <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
                  Tout est à jour. Aucun loyer en attente.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {actionDues.slice(0, 8).map((due) => (
                    <div
                      key={due.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                    >
                      <div>
                        <p className="font-medium text-neutral-950 dark:text-neutral-50">
                          {tenantName(due.tenant_id)} — {unitName(due.unit_id)}
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {formatAmount(due.amount_due)} · échéance {formatDate(due.due_date)}
                          {due.status === "overdue" ? " · en retard" : ""}
                        </p>
                      </div>
                      <Link
                        href={`/collections/new?lease_id=${due.lease_id}`}
                        className="shrink-0 rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
                      >
                        Encaisser
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {!hasProperties ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Première étape : ajouter un lieu
            </h2>
            <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Une maison, un immeuble, une cour ou une boutique où vous encaissez un loyer.
            </p>
            <Link
              href="/properties/new"
              className="mt-5 inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Ajouter mon premier lieu
            </Link>
          </div>
        ) : null}

        {hasProperties && !hasUnits ? (
          <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                Deuxième étape : ajouter un logement
              </h2>
              <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
                Décrivez le premier espace qui peut recevoir un locataire.
              </p>
            </div>

            <div className="space-y-3">
              {properties.map((property) => (
                <article
                  key={property.id}
                  className="rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                >
                  <h3 className="font-medium text-neutral-950 dark:text-neutral-50">
                    {property.name}
                  </h3>
                  {property.city || property.address ? (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {[property.city, property.address].filter(Boolean).join(" — ")}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            <Link
              href="/units/new"
              className="inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Ajouter mon premier logement
            </Link>
          </div>
        ) : null}

        {hasUnits ? (
          <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                Vos logements
              </h2>
              <p className="mt-2 text-base leading-7 text-neutral-600 dark:text-neutral-300">
                {hasActiveLease
                  ? "Vos baux sont actifs. Suivez les loyers reçus et en retard."
                  : hasLeases
                    ? "Activez votre bail pour générer les échéances de loyer."
                    : hasTenants
                      ? "Créez un bail entre un logement et un locataire."
                      : "Le premier logement est prêt. Ajoutez maintenant un locataire."}
              </p>
            </div>

            <div className="space-y-3">
              {units.map((unit) => (
                <article
                  key={unit.id}
                  className="rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                >
                  <h3 className="font-medium text-neutral-950 dark:text-neutral-50">
                    {unit.name}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {unitTypeLabels[unit.unit_type] ?? "Logement"} — disponible
                  </p>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/tenants/new"
                className="inline-flex rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Ajouter un locataire
              </Link>
              <Link
                href="/leases/new"
                className="inline-flex rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50"
              >
                Créer un bail
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
