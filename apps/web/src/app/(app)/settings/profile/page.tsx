import Link from "next/link"
import { ChevronRight, Landmark, LogOut, Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react"
import { formatPhoneForDisplay } from "@/lib/auth/countries"
import { requireLandlordProfile } from "@/lib/landlords"
import { updateLandlordAddress } from "@/lib/landlords/actions"
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL, SUPPORT_WHATSAPP_URL } from "@/lib/support"
import { HelpCenter } from "@/components/help-center"
import { ResumeOnboarding } from "@/components/resume-onboarding"
import { SubmitButton } from "@/components/submit-button"

type ProfileSettingsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase().trim() || "R"
}

// Groupe de réglages : titre discret (pas un eyebrow majuscule, cf. DESIGN.md)
// au-dessus d'une carte blanche, façon Moneco.
function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  )
}

// Ligne à pastille ronde d'icône (référence Moneco). Lien interne ou externe.
function SettingsRow({
  href,
  external,
  Icon,
  label,
  value,
}: {
  href: string
  external?: boolean
  Icon: LucideIcon
  label: string
  value?: string
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-accent">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {value ? <p className="truncate text-xs text-muted-foreground">{value}</p> : null}
      </div>
      <ChevronRight size={18} strokeWidth={1.8} className="flex-shrink-0 text-muted-foreground" />
    </>
  )
  const cls = "flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-secondary"
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {content}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {content}
    </Link>
  )
}

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const ownerName = `${landlord.first_name} ${landlord.last_name}`
  const resumable = landlord.onboarding_status === "exploring"

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-6 py-8 lg:py-14">
      <header className="flex flex-col items-center gap-3 pb-2 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-foreground">
          {initialsOf(landlord.first_name, landlord.last_name)}
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-title">{ownerName}</h1>
          <p className="text-sm text-muted-foreground">Propriétaire</p>
        </div>
      </header>

      {params?.error ? (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {params.error}
        </p>
      ) : null}

      <SettingsGroup title="Profil">
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-accent">
            <Phone size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Téléphone</p>
            <p className="truncate text-xs text-muted-foreground">{formatPhoneForDisplay(landlord.phone)}</p>
          </div>
        </div>
      </SettingsGroup>

      <p className="px-1 text-xs leading-6 text-muted-foreground">
        Votre nom et votre numéro apparaissent sur le registre et les quittances. Ils sont verrouillés :
        pour les corriger, Ranti passe par une vérification et garde une trace du changement.
      </p>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium text-muted-foreground">Adresse du bailleur</h2>
        <form action={updateLandlordAddress} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          {params?.success === "adresse" ? (
            <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              Adresse enregistrée.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium text-foreground">Adresse</label>
            <input
              id="address"
              name="address"
              type="text"
              maxLength={200}
              defaultValue={landlord.address ?? ""}
              placeholder="Rue, quartier, repère"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="city" className="text-sm font-medium text-foreground">Ville</label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={120}
              defaultValue={landlord.city ?? ""}
              placeholder="Cotonou"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
            />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Elle figure sur vos quittances pour vous identifier comme bailleur (loi n&deg;2022-30, art. 67).
          </p>
          <SubmitButton className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60 sm:w-fit">
            Enregistrer l&apos;adresse
          </SubmitButton>
        </form>
      </section>

      <div className="space-y-2">
        <SettingsGroup title="Recevoir les loyers">
          <SettingsRow
            href="/settings/payment"
            Icon={Landmark}
            label="Alias PI-SPI"
            value={landlord.payment_alias ? landlord.payment_alias : "Ajouter votre alias de paiement"}
          />
        </SettingsGroup>
        <p className="px-1 text-xs leading-6 text-muted-foreground">
          Vos locataires paient le loyer directement, instantané et gratuit.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium text-muted-foreground">Aide</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <HelpCenter />
          {SUPPORT_WHATSAPP_URL ? (
            <SettingsRow href={SUPPORT_WHATSAPP_URL} external Icon={MessageCircle} label="WhatsApp Ranti" />
          ) : null}
          <SettingsRow href={SUPPORT_EMAIL_URL} external Icon={Mail} label="Email" value={SUPPORT_EMAIL} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium text-muted-foreground">Compte</h2>
        {resumable ? <ResumeOnboarding /> : null}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-secondary"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <LogOut size={18} strokeWidth={1.8} />
              </span>
              <span className="text-sm font-medium text-destructive">Se déconnecter</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
