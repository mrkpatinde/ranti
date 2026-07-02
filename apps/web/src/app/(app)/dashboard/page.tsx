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
    { label: "Lieu", done: hasProperties, href: "/properties" },
    { label: "Logement", done: hasUnits, href: "/units" },
    { label: "Locataire", done: hasTenants, href: "/tenants" },
    { label: "Bail", done: hasLeases, href: "/leases" },
    { label: "Loyers", done: hasActiveLease, href: "/leases" },
  ]
}

// Cartes de synthèse — les trois réponses des 5 secondes : encaissé, en
// retard, à venir. Tons repris du système Ranti (docs/design/).
function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone: "brand" | "red" | "stone"
}) {
  const tones = {
    brand: "border-primary/15 bg-primary text-primary-foreground",
    red: "border-red-200 bg-red-50 text-red-950",
    stone: "border-border bg-card text-foreground",
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="font-display mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm opacity-75">{helper}</p>
    </div>
  )
}

function StatusPill({ tone, children }: { tone: "late" | "upcoming"; children: React.ReactNode }) {
  const tones = {
    late: "bg-red-50 text-red-700 border border-red-200",
    upcoming: "bg-muted text-muted-foreground border border-border",
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
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
  const sumRemaining = (list: typeof dues): number => list.reduce((total, due) => total + remaining(due), 0)
  const overdueRemaining = sumRemaining(overdue)
  const expectedRemaining = sumRemaining(expected)
  const totalPaid = dues.reduce((total, due) => total + due.amount_paid, 0)
  const paidCount = dues.filter((due) => due.status === "paid").length
  const actionDues = [...overdue, ...expected].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const overdueTenantCount = new Set(overdue.map((due) => due.tenant_id)).size

  const nextAction = !hasProperties
    ? { href: "/properties/new", label: "Ajouter mon premier lieu", title: "Première étape : ajouter un lieu", body: "Une maison, une cour, un immeuble ou une boutique où vous encaissez un loyer." }
    : !hasUnits
      ? { href: "/units/new", label: "Ajouter mon premier logement", title: "Deuxième étape : ajouter un logement", body: "Décrivez le premier espace qui peut recevoir un locataire." }
      : !hasTenants
        ? { href: "/tenants/new", label: "Ajouter un locataire", title: "Troisième étape : ajouter un locataire", body: "Ajoutez une personne joignable pour permettre les relances." }
        : !hasLeases
          ? { href: "/leases/new", label: "Créer un bail", title: "Quatrième étape : créer un bail", body: "Indiquez le loyer, la date d'échéance et le logement concerné." }
          : !hasActiveLease
            ? { href: "/leases", label: "Activer un bail", title: "Dernière étape : activer le bail", body: "Activez le bail pour générer les loyers attendus." }
            : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      {isLocalMode ? (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-accent-foreground">
          Mode local actif. Développement sans provider SMS.
        </section>
      ) : null}

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-extrabold capitalize tracking-tight sm:text-4xl">{formatMonth()}</h1>
            <p className="text-base leading-7 text-foreground/70">
              Bonjour {landlord.first_name}
              {hasActiveLease ? ` — ${activeLeaseCount} bail${activeLeaseCount > 1 ? "x" : ""} actif${activeLeaseCount > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          {hasActiveLease ? (
            <Link href="/collections/new" className="inline-flex shrink-0 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(242,163,60,0.55)] transition hover:brightness-95">
              Confirmer un paiement
            </Link>
          ) : null}
        </div>

        <div className="space-y-2">
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {setupSteps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-2">
                <Link href={step.href} className={step.done ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-primary-foreground transition hover:bg-primary/90" : "rounded-full border border-border px-3 py-1.5 text-muted-foreground transition hover:border-primary hover:text-foreground"}>
                  {step.done ? "✓ " : ""}{step.label}
                </Link>
                {index < setupSteps.length - 1 ? <span aria-hidden className="text-muted-foreground">→</span> : null}
              </li>
            ))}
          </ol>
          <p className="text-sm leading-6 text-muted-foreground">ⓘ Le registre se construit dans cet ordre : un lieu contient des logements, un logement se loue à un locataire par un bail, et le bail activé génère les loyers à suivre. Touchez une étape pour la gérer.</p>
        </div>

        {hasActiveLease ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Encaissé ce mois" value={formatAmount(totalPaid)} helper={`${paidCount} échéance${paidCount > 1 ? "s" : ""} soldée${paidCount > 1 ? "s" : ""}`} tone="brand" />
              <StatCard
                label={overdueTenantCount > 0 ? `En retard — ${overdueTenantCount} locataire${overdueTenantCount > 1 ? "s" : ""}` : "En retard"}
                value={formatAmount(overdueRemaining)}
                helper={`${overdue.length} échéance${overdue.length > 1 ? "s" : ""} à traiter`}
                tone="red"
              />
              <StatCard label="À venir" value={formatAmount(expectedRemaining)} helper={`${expected.length} échéance${expected.length > 1 ? "s" : ""} attendue${expected.length > 1 ? "s" : ""}`} tone="stone" />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-extrabold tracking-tight">À encaisser</h2>
                <Link href="/collections" className="text-sm font-medium underline-offset-4 hover:underline">
                  Voir les encaissements
                </Link>
              </div>
              {actionDues.length === 0 ? (
                <p className="mt-2 text-base leading-7 text-foreground/70">Tout est à jour. Aucun loyer en attente.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {actionDues.slice(0, 8).map((due) => (
                    <div key={due.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 transition hover:bg-secondary/60">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{tenantName(due.tenant_id)} — {unitName(due.unit_id)}</p>
                          <StatusPill tone={due.status === "overdue" ? "late" : "upcoming"}>{due.status === "overdue" ? "En retard" : "Attendu"}</StatusPill>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">reste {formatAmount(remaining(due))} · échéance {formatDate(due.due_date)}{due.amount_paid > 0 ? ` · ${formatAmount(due.amount_paid)} déjà reçu` : ""}</p>
                      </div>
                      <Link href={`/collections/new?lease_id=${due.lease_id}`} className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Confirmer le paiement reçu</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {nextAction ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">À faire</p>
            <h2 className="font-display mt-3 text-xl font-extrabold tracking-tight">{nextAction.title}</h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">{nextAction.body}</p>
            <Link href={nextAction.href} className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(242,163,60,0.55)] transition hover:brightness-95">{nextAction.label}</Link>
          </div>
        ) : null}

        {hasProperties ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold tracking-tight">Vos lieux</h2>
              <Link href="/properties" className="text-sm font-medium underline-offset-4 hover:underline">Gérer</Link>
            </div>
            <div className="space-y-3">
              {properties.slice(0, 4).map((property) => (
                <Link key={property.id} href={`/properties/${property.id}`} className="block rounded-2xl border border-border px-4 py-3 transition hover:border-primary hover:bg-secondary/60">
                  <h3 className="font-semibold">{property.name}</h3>
                  {property.city || property.address ? <p className="mt-1 text-sm text-muted-foreground">{[property.city, property.address].filter(Boolean).join(" — ")}</p> : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {hasUnits ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold tracking-tight">Vos logements</h2>
              <Link href="/units" className="text-sm font-medium underline-offset-4 hover:underline">Gérer</Link>
            </div>
            <div className="space-y-3">
              {units.slice(0, 6).map((unit) => (
                <Link key={unit.id} href={`/units/${unit.id}`} className="block rounded-2xl border border-border px-4 py-3 transition hover:border-primary hover:bg-secondary/60">
                  <h3 className="font-semibold">{unit.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{unitTypeLabels[unit.unit_type] ?? "Logement"} — {propertyName(unit.property_id)}</p>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/tenants/new" className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Ajouter un locataire</Link>
              <Link href="/leases/new" className="inline-flex rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-primary">Créer un bail</Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
