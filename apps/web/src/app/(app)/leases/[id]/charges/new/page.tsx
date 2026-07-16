import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLease } from "@/lib/leases"
import { addLeaseCharge } from "@/lib/ledger"
import { getTenant } from "@/lib/tenants"

// Ajouter une charge variable au compte du bail (ADR-023, matrice §3 ligne 2).
// La charge naît « en attente » : elle ne devient certaine qu'après validation
// du locataire par lien signé — une affirmation dans son propre intérêt ne
// devient jamais certaine seule.

export const metadata = { title: "Ajouter une charge — Ranti" }

export default async function NewChargePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams

  const lease = await getLease(landlord.id, id)
  if (!lease) notFound()
  const tenant = await getTenant(landlord.id, lease.tenant_id)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">Nouvelle charge</p>
        <Link
          href={`/leases/${lease.id}`}
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour au bail
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-6 py-10">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground lg:text-3xl">
            Ajouter une charge
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Votre locataire"} recevra un
            lien pour valider cette somme ou signaler une erreur. Elle n&apos;entre au solde
            qu&apos;une fois validée.
          </p>
        </div>

        {sp?.error ? (
          <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {sp.error}
          </p>
        ) : null}

        <form action={addLeaseCharge} className="space-y-6">
          <input type="hidden" name="lease_id" value={lease.id} />
          <input type="hidden" name="request_id" value={crypto.randomUUID()} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Nature</legend>
            {[
              { value: "reparation", label: "Réparation", hint: "serrure, plomberie, peinture…" },
              { value: "frais", label: "Frais", hint: "gardiennage, ordures, eau commune…" },
            ].map((n) => (
              <label
                key={n.value}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary"
              >
                <input type="radio" name="type" value={n.value} required className="accent-primary" />
                <span className="font-medium text-foreground">{n.label}</span>
                <span className="text-muted-foreground">{n.hint}</span>
              </label>
            ))}
          </fieldset>

          <div>
            <label htmlFor="label" className="text-sm font-medium text-foreground">
              Description
            </label>
            <input
              id="label"
              name="label"
              type="text"
              required
              maxLength={120}
              placeholder="Ex. Réparation serrure porte d'entrée"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="amount" className="text-sm font-medium text-foreground">
              Montant (FCFA)
            </label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="numeric"
              required
              placeholder="Ex. 5000"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="due_date" className="text-sm font-medium text-foreground">
              À régler avant <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sans date, la somme est due dès sa validation.
            </p>
          </div>

          <SubmitButton
            className="inline-flex w-full justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60"
            pendingLabel="Ajout…"
          >
            Ajouter la charge
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
