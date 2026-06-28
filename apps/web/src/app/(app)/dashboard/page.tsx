import Link from "next/link"
import { isLocalAuthEnabled } from "@/lib/auth"
import { formatFcfa } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordProperties } from "@/lib/properties"
import { getLandlordDueBalances } from "@/lib/rent-dues"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"

function formatAmount(amount: number): string {
  return formatFcfa(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function formatMonth(date = new Date()): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
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
    { label: "Lieu", done: hasProperties },
    { label: "Logement", done: hasUnits },
    { label: "Locataire", done: hasTenants },
    { label: "Bail", done: hasLeases },
    { label: "Loyers", done: hasActiveLease },
  ]
}

function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone: "danger" | "warning" | "success" | "neutral"
}) {
  const tones = {
    danger: "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-50",
    warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50",
    neutral: "border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50",
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm opacity-75">{helper}</p>
    </div>
  )
}

function EmptyState({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">À faire</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{title}</h2>
      <p className="mt-3 max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300">{body}</p>
      <Link href={href} className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">
        {label}
      </Link>
    </div>
  )
}

export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const [properties, units, tenants, leases, dues] = await Promise.all([
    getLandlordProperties(landlord.id),
    getLandlordUnits(landlord.id),
    getLandlordTenants(landlord.id),
    getLandlordLeases(landlord.id),
    getLandlordDueBalances(landlord.id),
  ])

  const hasProperties = properties.length > 0
  const hasUnits = units.length > 0
  const hasTenants = tenants.length > 0
  const hasLeases = leases.length > 0
  const activeLeaseCount = leases.filter((lease) => lease.status === "active").length
  const hasActiveLease = activeLeaseCount > 0
  const setupSteps = buildSetupSteps(hasProperties, hasUnits, hasTenants, hasLeases, hasActiveLease)
  const isLocalMode = isLocalAuthEnabled()

  const propertyName = (id: string): string => properties.find((property) => property.id === id)?.name ?? "Lieu"
  const unitName = (id: string): string => units.find((unit) => unit.id === id)?.name ?? "Logement"
  const tenantName = (id: string): string => {
    const tenant = tenants.find((item) => item.id === id)
    return tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"
  }
  const remaining = (due: (typeof dues)[number]): number => Math.max(0, due.amount_due - due.amount_paid)
  const overdue = dues.filter((due) => due.status === "overdue")
  const expected = dues.filter((due) => due.status === "expected")
  const paid = dues.filter((due) => due.status === "paid")
  const sumRemaining = (list: typeof dues): number => list.reduce((total, due) => total + remaining(due), 0)
  const overdueRemaining = sumRemaining(overdue)
  const expectedRemaining = sumRemaining(expected)
  const totalPaid = dues.reduce((total, due) => total + due.amount_paid, 0)
  const actionDues = [...overdue, ...expected].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const urgentDue = actionDues[0]
  const collectionRate = dues.length > 0 ? Math.round((paid.length / dues.length) * 100) : 0

  const nextAction = !hasProperties
    ? { href: "/properties/new", label: "Ajouter mon premier lieu", title: "Première étape : ajouter un lieu", body: "Une maison, une cour, un immeuble ou une boutique où vous encaissez un loyer." }
    : !hasUnits
      ? { href: "/units/new", label: "Ajouter mon premier logement", title: "Deuxième étape : ajouter un logement", body: "Décrivez le premier espace qui peut recevoir un locataire." }
      : !hasTenants
        ? { href: "/tenants/new", label: "Ajouter un locataire", title: "Troisième étape : ajouter un locataire", body: "Ajoutez une personne joignable pour permettre les relances." }
        : !hasLeases
          ? { href: "/leases/new", label: "Créer un bail", title: "Quatrième étape : créer un bail", body: "Indiquez le loyer, la date d’échéance et le logement concerné." }
          : !hasActiveLease
            ? { href: "/leases", label: "Activer un bail", title: "Dernière étape : activer le bail", body: "Activez le bail pour générer les loyers attendus." }
            : null

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {isLocalMode ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Mode local actif. Développement sans provider SMS.
          </section>
        ) : null}

        <header className="flex flex-col gap-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">Tableau de bord · {formatMonth()}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
              Bonjour {landlord.first_name}.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Votre registre de loyer doit vous dire quoi faire maintenant, pas seulement afficher des cartes statiques.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/collections/new" className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">
              Encaisser un loyer
            </Link>
            <Link href="/leases/new" className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-50">
              Créer un bail
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="En retard" value={formatAmount(overdueRemaining)} helper={`${overdue.length} échéance${overdue.length > 1 ? "s" : ""} à traiter`} tone="danger" />
              <StatCard label="Attendu" value={formatAmount(expectedRemaining)} helper={`${expected.length} échéance${expected.length > 1 ? "s" : ""} à venir`} tone="warning" />
              <StatCard label="Déjà encaissé" value={formatAmount(totalPaid)} helper={`${collectionRate}% des échéances soldées`} tone="success" />
            </div>

            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">Priorité</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">À encaisser maintenant</h2>
                </div>
                <Link href="/collections" className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200">
                  Voir les encaissements
                </Link>
              </div>

              {actionDues.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50">
                  <p className="font-semibold">Tout est à jour.</p>
                  <p className="mt-1 text-sm opacity-80">Aucun loyer en attente pour le moment.</p>
                </div>
              ) : (
                <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-3xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {actionDues.slice(0, 8).map((due) => {
                    const isOverdue = due.status === "overdue"
                    return (
                      <div key={due.id} className="grid gap-4 bg-white p-4 transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-neutral-950 dark:text-neutral-50">{tenantName(due.tenant_id)}</p>
                            <span className={isOverdue ? "rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-100" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-100"}>
                              {isOverdue ? "En retard" : "Attendu"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                            {unitName(due.unit_id)} · échéance {formatDate(due.due_date)}
                          </p>
                          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                            Reste {formatAmount(remaining(due))}{due.amount_paid > 0 ? ` · ${formatAmount(due.amount_paid)} déjà reçu` : ""}
                          </p>
                        </div>
                        <Link href={`/collections/new?lease_id=${due.lease_id}`} className="inline-flex justify-center rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">
                          Encaisser
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {urgentDue ? (
              <section className="rounded-[2rem] border border-neutral-200 bg-neutral-950 p-6 text-white shadow-sm dark:border-neutral-800">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">Prochaine action</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">Relancer ou encaisser {tenantName(urgentDue.tenant_id)}</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-300">
                  {unitName(urgentDue.unit_id)} · reste {formatAmount(remaining(urgentDue))} · échéance {formatDate(urgentDue.due_date)}
                </p>
                <Link href={`/collections/new?lease_id=${urgentDue.lease_id}`} className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200">
                  Traiter maintenant
                </Link>
              </section>
            ) : nextAction ? (
              <EmptyState title={nextAction.title} body={nextAction.body} href={nextAction.href} label={nextAction.label} />
            ) : (
              <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">Prochaine action</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Respirer.</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Aucun paiement urgent. Votre registre est propre pour le moment.</p>
              </section>
            )}

            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">Configuration</p>
              <div className="mt-5 space-y-3">
                {setupSteps.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className={step.done ? "flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950" : "flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-sm font-medium text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"}>
                      {step.done ? "✓" : index + 1}
                    </span>
                    <span className={step.done ? "text-sm font-medium text-neutral-950 dark:text-neutral-50" : "text-sm text-neutral-500 dark:text-neutral-400"}>{step.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">Portefeuille</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Vos lieux</h2>
              </div>
              <Link href="/properties" className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200">Gérer</Link>
            </div>
            {hasProperties ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {properties.slice(0, 4).map((property) => (
                  <Link key={property.id} href={`/properties/${property.id}`} className="rounded-3xl border border-neutral-200 p-4 transition hover:border-neutral-950 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-50 dark:hover:bg-neutral-800/50">
                    <h3 className="font-semibold text-neutral-950 dark:text-neutral-50">{property.name}</h3>
                    {property.city || property.address ? <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{[property.city, property.address].filter(Boolean).join(" — ")}</p> : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Ajoutez un premier lieu pour démarrer votre registre.</p>
            )}
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-400">Occupation</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Vos logements</h2>
              </div>
              <Link href="/units" className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200">Gérer</Link>
            </div>
            {hasUnits ? (
              <div className="mt-5 space-y-3">
                {units.slice(0, 5).map((unit) => (
                  <Link key={unit.id} href={`/units/${unit.id}`} className="flex items-center justify-between gap-4 rounded-3xl border border-neutral-200 px-4 py-3 transition hover:border-neutral-950 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-50 dark:hover:bg-neutral-800/50">
                    <div>
                      <h3 className="font-semibold text-neutral-950 dark:text-neutral-50">{unit.name}</h3>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{unitTypeLabels[unit.unit_type] ?? "Logement"} · {propertyName(unit.property_id)}</p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Voir</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Aucun logement enregistré pour le moment.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/tenants/new" className="inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">Ajouter un locataire</Link>
              <Link href="/units/new" className="inline-flex rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-50">Ajouter un logement</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
