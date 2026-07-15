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
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

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
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Modifier le bail</p>
        </div>
        <Link href={`/leases/${lease.id}`} className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Retour</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Corriger le bail</h1>
          <p className="text-base leading-7 text-foreground/70">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "Locataire"} — {unit?.name ?? "Logement"}</p>
          {!isDraft ? <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-foreground">Ce bail est déjà activé. Ranti ne permet pas de le modifier librement pour protéger l&apos;historique des loyers.</p> : null}
        </div>

        {sp?.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</p> : null}

        <form action={updateLease} className="space-y-5">
          <input type="hidden" name="id" value={lease.id} />
          <div className="space-y-2">
            <label htmlFor="monthly_rent_amount" className={labelClass}>Loyer mensuel (FCFA)</label>
            <input id="monthly_rent_amount" name="monthly_rent_amount" type="text" inputMode="numeric" required defaultValue={String(lease.monthly_rent_amount)} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="due_day" className={labelClass}>Jour d&apos;échéance</label>
            <input id="due_day" name="due_day" type="number" min={1} max={31} required defaultValue={lease.due_day} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="start_date" className={labelClass}>Date de début</label>
            <input id="start_date" name="start_date" type="date" required defaultValue={lease.start_date} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="end_date" className={labelClass}>Date de fin <span className="text-muted-foreground">(optionnel)</span></label>
            <input id="end_date" name="end_date" type="date" defaultValue={lease.end_date ?? ""} disabled={!isDraft} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>Note <span className="text-muted-foreground">(optionnel)</span></label>
            <textarea id="notes" name="notes" rows={3} defaultValue={lease.notes ?? ""} disabled={!isDraft} className={inputClass} />
          </div>
          {isDraft ? <SubmitButton className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">Enregistrer</SubmitButton> : null}
        </form>
      </section>
    </main>
  )
}
