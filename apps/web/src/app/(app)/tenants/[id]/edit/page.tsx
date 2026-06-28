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
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

export default async function EditTenantPage({ params, searchParams }: EditTenantPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const tenant = await getTenant(landlord.id, id)

  if (!tenant) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Modifier le locataire</p>
        </div>
        <Link href={`/tenants/${tenant.id}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">Retour</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Corriger les informations</h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">Le numéro reste obligatoire pour permettre les relances.</p>
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{sp.error}</p> : null}

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
              <span className="inline-flex items-center rounded-l-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">🇧🇯 +229</span>
              <BeninPhoneInput id="phone" name="phone" defaultValue={toLocalPhone(tenant.phone ?? "")} required className={phoneInputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className={labelClass}>Email <span className="text-neutral-400">(optionnel)</span></label>
            <input id="email" name="email" type="email" defaultValue={tenant.email ?? ""} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>Note <span className="text-neutral-400">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={tenant.notes ?? ""} className={inputClass} />
          </div>
          <SubmitButton className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">Enregistrer</SubmitButton>
        </form>
      </section>
    </main>
  )
}
