import Link from "next/link"
import { BeninPhoneInput } from "@/components/benin-phone-input"
import { SubmitButton } from "@/components/submit-button"
import { createTenant } from "@/lib/tenants"
import { requireLandlordProfile } from "@/lib/landlords"

type NewTenantPageProps = {
  searchParams?: Promise<{ error?: string; unit_id?: string }>
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

export default async function NewTenantPage({ searchParams }: NewTenantPageProps) {
  await requireLandlordProfile()
  const params = await searchParams
  const errorMessage = params?.error
  const nextUnitId = params?.unit_id

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Ranti</p>
          <p className="mt-2 text-sm text-muted-foreground">Nouveau locataire</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Étape 3 sur 5</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Qui doit recevoir les relances ?
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Ajoutez le locataire et son numéro. C’est ce numéro que Ranti utilisera pour les rappels de loyer.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={createTenant} className="space-y-5">
          {nextUnitId ? <input type="hidden" name="next_unit_id" value={nextUnitId} /> : null}

          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>
              Prénom
            </label>
            <input id="first_name" name="first_name" type="text" required placeholder="Ex. Awa" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>
              Nom
            </label>
            <input id="last_name" name="last_name" type="text" required placeholder="Ex. Koffi" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>
              Numéro WhatsApp du locataire
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-border bg-background px-4 py-3 text-base text-foreground/70">
                🇧🇯 +229
              </span>
              <BeninPhoneInput id="phone" name="phone" required className={phoneInputClass} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Tapez les 10 chiffres : les espaces s’ajoutent automatiquement.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className={labelClass}>
              Email <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <input id="email" name="email" type="email" placeholder="Ex. awa@email.com" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Note <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <textarea id="notes" name="notes" rows={3} placeholder="Information utile" className={inputClass} />
          </div>

          <SubmitButton
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            Continuer vers le bail
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
