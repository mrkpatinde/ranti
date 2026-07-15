import Link from "next/link"
import { formatPhoneForDisplay } from "@/lib/auth/countries"
import { requireLandlordProfile } from "@/lib/landlords"
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL, SUPPORT_WHATSAPP_URL } from "@/lib/support"

type ProfileSettingsPageProps = {
  searchParams?: Promise<{ error?: string }>
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-medium text-foreground">{value}</p>
    </div>
  )
}

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Profil propriétaire</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-6 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Identité du propriétaire</h1>
          <p className="text-base leading-7 text-foreground/70">
            Ces informations apparaissent dans le registre, les reçus et les quittances. Elles sont verrouillées pour éviter les changements incohérents.
          </p>
        </div>

        {params?.error ? (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-foreground">
            {params.error}
          </p>
        ) : null}

        <div className="space-y-3">
          <ProfileRow label="Prénom" value={landlord.first_name} />
          <ProfileRow label="Nom" value={landlord.last_name} />
          <ProfileRow label="Téléphone" value={formatPhoneForDisplay(landlord.phone)} />
        </div>

        <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground/70">
          Pour corriger ces informations plus tard, Ranti devra passer par une vérification et garder une trace du changement.
        </p>

        <div className="space-y-3">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Recevoir les loyers</h2>
          <Link
            href="/settings/payment"
            className="block rounded-2xl border border-border bg-card px-4 py-3 transition hover:bg-secondary"
          >
            <p className="text-xs text-muted-foreground">Alias PI-SPI</p>
            <p className="mt-1 text-base font-medium text-foreground">
              {landlord.payment_alias ? landlord.payment_alias : "Ajouter votre alias de paiement"}
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground/60">
              Vos locataires paient le loyer directement — instantané et gratuit.
            </p>
          </Link>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Besoin d&apos;aide ?</h2>
          <p className="text-sm leading-6 text-foreground/70">
            {SUPPORT_WHATSAPP_URL
              ? "En cas de problème ou de question, contactez Ranti par WhatsApp ou par email."
              : "En cas de problème ou de question, contactez Ranti par email."}
          </p>
          <div className="space-y-3">
            {SUPPORT_WHATSAPP_URL && (
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card px-4 py-3 transition hover:bg-secondary"
              >
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="mt-1 text-base font-medium text-foreground">Écrire au WhatsApp de Ranti</p>
              </a>
            )}
            <a
              href={SUPPORT_EMAIL_URL}
              className="block rounded-2xl border border-border bg-card px-4 py-3 transition hover:bg-secondary"
            >
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-1 text-base font-medium text-foreground">{SUPPORT_EMAIL}</p>
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-foreground"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
