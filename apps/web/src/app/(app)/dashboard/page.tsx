import Link from "next/link"
import { VoiceCapture } from "./_components/voice-capture"
import { SmsIngestionZone } from "./_components/sms-ingestion-zone"
import { JournalTimeline } from "../journal/_components/journal-timeline"
import { isLocalAuthEnabled } from "@/lib/auth"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordLeases } from "@/lib/leases"
import { getLandlordProperties } from "@/lib/properties"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import { getJournalFeed, countThisMonth } from "@/lib/journal"

export const metadata = { title: "Ranti" }

// Prochaine action unique du parcours d'accueil (welcome-flow.md, verrouillé) :
// tant qu'aucun bail n'est actif, on ne montre qu'UN seul geste à faire, dans
// l'ordre lieu → logement → locataire → bail → activation. Pas de bandeau
// d'étapes ni de compteurs (supprimés : friction contraire à l'esprit journal).
function buildNextAction(
  hasProperties: boolean,
  hasUnits: boolean,
  hasTenants: boolean,
  hasLeases: boolean
) {
  if (!hasProperties)
    return { href: "/properties/new", label: "Ajouter mon premier lieu", title: "Première étape : ajouter un lieu", body: "Une maison, une cour, un immeuble ou une boutique où vous encaissez un loyer." }
  if (!hasUnits)
    return { href: "/units/new", label: "Ajouter mon premier logement", title: "Deuxième étape : ajouter un logement", body: "Décrivez le premier espace qui peut recevoir un locataire." }
  if (!hasTenants)
    return { href: "/tenants/new", label: "Ajouter un locataire", title: "Troisième étape : ajouter un locataire", body: "Ajoutez une personne joignable pour permettre les relances." }
  if (!hasLeases)
    return { href: "/leases/new", label: "Créer un bail", title: "Quatrième étape : créer un bail", body: "Indiquez le loyer, la date d'échéance et le logement concerné." }
  return { href: "/leases", label: "Activer un bail", title: "Dernière étape : activer le bail", body: "Activez le bail pour générer les loyers attendus." }
}

// Accueil unifié = journal de bord chronologique (ADR-014). Deux entrées de
// capture ambiantes en tête (vocal + collage SMS MoMo), puis le flux en lecture.
// Contrôle d'accès : layout (app) → requireAuth() (Google, ADR-010) ; ici
// requireLandlordProfile() → profil complet ou redirection onboarding. Le flux
// journal ne s'affiche qu'avec ≥ 1 bail actif ; sinon, geste d'accueil unique.
export default async function DashboardPage() {
  const landlord = await requireLandlordProfile()
  const isLocalMode = isLocalAuthEnabled()

  const leases = await getLandlordLeases(landlord.id)
  const hasActiveLease = leases.some((lease) => lease.status === "active")

  if (!hasActiveLease) {
    const [properties, units, tenants] = await Promise.all([
      getLandlordProperties(landlord.id),
      getLandlordUnits(landlord.id),
      getLandlordTenants(landlord.id),
    ])
    const nextAction = buildNextAction(
      properties.length > 0,
      units.length > 0,
      tenants.length > 0,
      leases.length > 0
    )

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-12">
        {isLocalMode ? (
          <section className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-accent-foreground">
            Mode local actif. Développement sans provider SMS.
          </section>
        ) : null}

        <header className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Ranti</h1>
          <p className="text-sm text-muted-foreground">Bonjour {landlord.first_name}</p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">À faire</p>
          <h2 className="font-display mt-3 text-xl font-extrabold tracking-tight">{nextAction.title}</h2>
          <p className="mt-2 text-base leading-7 text-foreground/70">{nextAction.body}</p>
          <Link
            href={nextAction.href}
            className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:brightness-95"
          >
            {nextAction.label}
          </Link>
        </div>
      </main>
    )
  }

  const events = await getJournalFeed()
  const monthCount = countThisMonth(events)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-6 py-12">
      {isLocalMode ? (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-accent-foreground">
          Mode local actif. Développement sans provider SMS.
        </section>
      ) : null}

      {/* En-tête sobre : titre + résumé discret du mois. */}
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Ranti</h1>
        <p className="text-sm text-muted-foreground">
          {monthCount > 0
            ? `${monthCount} évènement${monthCount > 1 ? "s" : ""} ce mois-ci`
            : "Aucun évènement ce mois-ci"}
        </p>
      </header>

      {/* Les deux gestes de capture ambiants, en tête du flux (ADR-014). */}
      <section className="space-y-4">
        <VoiceCapture />
        <SmsIngestionZone />
      </section>

      {/* Le flux — timeline chronologique en lecture. */}
      <JournalTimeline events={events} />
    </main>
  )
}
