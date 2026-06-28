/* eslint-disable react/no-unescaped-entities */
import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLease, updateLease } from "@/lib/leases"
import { getTenant } from "@/lib/tenants"
import { getUnit } from "@/lib/units"

type EditLeasePageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-50"
const labelClass = "block text-sm font-medium text-neutral-800 dark:text-neutral-100"

export default async function EditLeasePage({ params, searchParams }: EditLeasePageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const lease = await getLease(landlord.id, id)

  if (!lease) notFound()

  const [unit, tenant] = await Promise.all([
    getUnit(landlord.id, lease.unit_id),
    getTenant(landlord.id, lease.tenant_id),
  ])
  const isDraft = lease.status === "draft"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">Ranti</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Modifier le bail</p>
        </div>
        <Link href={`/leases/${lease.id}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300">Retour</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Corriger le bail</h1>
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-300">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}</p>
          {!isDraft ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Ce bail est déjà activé. Ranti ne permet pas de le modifier librement pour protéger l'historique des loyers.</p> : null}
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{sp.error}</p> : null}

        <form action={updateLease} className="space-y-5">
          <input type="hidden" name="id" value={lease.id} />
          <div className="space-y-2">
            <label htmlFor="monthly_rent_amount" className={labelClass}>Loyer mensuel (FCFA)</label>
            <input id="monthly_rent_amount" name="monthly_rent_amount" type="text" inputMode="numeric" required defaultValue={String(lease.monthly_rent_amount)} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="due_day" className={labelClass}>Jour d'échéance</label>
            <input id="due_day" name="due_day" type="number" min={1} max={31} required defaultValue={lease.due_day} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="start_date" className={labelClass}>Date de début</label>
            <input id="start_date" name="start_date" type="date" required defaultValue={lease.start_date} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="end_date" className={labelClass}>Date de fin <span className="text-neutral-400">(optionnel)</span></label>
            <input id="end_date" name="end_date" type="date" defaultValue={lease.end_date ?? ""} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>Note <span className="text-neutral-400">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={lease.notes ?? ""} disabled={!isDraft} className={inputClass} />
          </div>
          {isDraft ? <SubmitButton className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200">Enregistrer</SubmitButton> : null}
        </form>
      </section>
    </main>
  )
}
