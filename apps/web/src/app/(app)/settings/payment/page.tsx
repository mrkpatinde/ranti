import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { updateLandlordPaymentAlias } from "@/lib/landlords/actions"
import { requireLandlordProfile } from "@/lib/landlords"

type PaymentSettingsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition focus:border-primary"
const labelClass = "block text-sm font-semibold"

export default async function PaymentSettingsPage({ searchParams }: PaymentSettingsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const alias = landlord.payment_alias ?? ""
  const aliasType = landlord.payment_alias_type ?? "phone"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Recevoir les loyers</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-6 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground">Votre alias PI-SPI</h1>
          <p className="text-base leading-7 text-foreground/70">
            Renseignez l&apos;alias sur lequel vos locataires paient le loyer. Ils envoient
            directement depuis leur appli (MTN, Moov, banque) — c&apos;est instantané et gratuit.
            Ranti affiche l&apos;alias au locataire mais ne touche jamais l&apos;argent : vous confirmez
            ensuite l&apos;encaissement comme d&apos;habitude.
          </p>
        </div>

        {params?.success ? (
          <p className="rounded-xl border border-primary/15 bg-secondary px-4 py-3 text-sm text-foreground">
            Alias enregistré.
          </p>
        ) : null}

        {params?.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {params.error}
          </p>
        ) : null}

        <form action={updateLandlordPaymentAlias} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="payment_alias_type" className={labelClass}>
              Type d&apos;alias
            </label>
            <select
              id="payment_alias_type"
              name="payment_alias_type"
              defaultValue={aliasType}
              className={inputClass}
            >
              <option value="phone">Numéro de téléphone</option>
              <option value="address">Adresse de paiement PI-SPI</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="payment_alias" className={labelClass}>
              Alias PI-SPI
            </label>
            <input
              id="payment_alias"
              name="payment_alias"
              type="text"
              defaultValue={alias}
              maxLength={64}
              placeholder="Ex : 01 97 00 00 00 ou votre adresse PI-SPI"
              className={inputClass}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Laissez vide pour ne pas afficher d&apos;alias aux locataires.
            </p>
          </div>

          <SubmitButton
            className="w-full rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:brightness-95 disabled:opacity-60"
          >
            Enregistrer
          </SubmitButton>
        </form>

        <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground/70">
          PI-SPI est le paiement instantané interopérable de la BCEAO : le locataire paie
          depuis n&apos;importe quelle banque ou wallet connecté, l&apos;argent arrive directement
          sur votre compte.
        </p>
      </section>
    </main>
  )
}
