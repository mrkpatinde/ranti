import Link from "next/link"
import { notFound } from "next/navigation"
import { BeninPhoneInput } from "@/components/benin-phone-input"
import { SubmitButton } from "@/components/submit-button"
import { toLocalPhone } from "@/lib/auth"
import { requireLandlordProfile } from "@/lib/landlords"
import { getTenant, updateTenant } from "@/lib/tenants"

type EditTenantPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

export default async function EditTenantPage({ params, searchParams }: EditTenantPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const tenant = await getTenant(landlord.id, id)

  if (!tenant) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Modifier le locataire</p>
        </div>
        <Link href={`/tenants/${tenant.id}`} className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Retour</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground">Corriger les informations</h1>
          <p className="text-base leading-7 text-foreground/70">Le numéro reste obligatoire pour permettre les relances.</p>
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</p> : null}

        <form action={updateTenant} className="space-y-5">
          <input type="hidden" name="id" value={tenant.id} />
          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>Prénom</label>
            <input id="first_name" name="first_name" type="text" required defaultValue={tenant.first_name} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>Nom</label>
            <input id="last_name" name="last_name" type="text" required defaultValue={tenant.last_name} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>Numéro WhatsApp</label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-border bg-background px-4 py-3 text-base text-foreground/70">🇧🇯 +229</span>
              <BeninPhoneInput id="phone" name="phone" defaultValue={toLocalPhone(tenant.phone ?? "")} required className={phoneInputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className={labelClass}>Email <span className="text-muted-foreground">(optionnel)</span></label>
            <input id="email" name="email" type="email" defaultValue={tenant.email ?? ""} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>Note <span className="text-muted-foreground">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={tenant.notes ?? ""} className={inputClass} />
          </div>
          <SubmitButton className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">Enregistrer</SubmitButton>
        </form>
      </section>
    </main>
  )
}
