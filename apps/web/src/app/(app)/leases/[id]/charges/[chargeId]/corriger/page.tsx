import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitButton } from "@/components/submit-button"
import { formatFcfa } from "@/lib/format"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLease } from "@/lib/leases"
import { getLeaseLedgerCharges, replaceLedgerCharge } from "@/lib/ledger"

// Corriger une charge = retrait + réémission liée (remplacement, ADR-023 §4).
// La ligne corrigée repart « en attente » avec un NOUVEAU lien : une correction
// n'hérite jamais de la confiance de la ligne qu'elle remplace.

export const metadata = { title: "Corriger la charge — Ranti" }

export default async function ReplaceChargePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chargeId: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const landlord = await requireLandlordProfile()
  const { id, chargeId } = await params
  const sp = await searchParams

  const lease = await getLease(landlord.id, id)
  if (!lease) notFound()

  const charges = await getLeaseLedgerCharges(landlord.id, lease.id)
  const charge = charges.find((c) => c.id === chargeId)
  if (!charge || (charge.status !== "pending" && charge.status !== "disputed")) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">Corriger la charge</p>
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
            {charge.label}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Actuellement {formatFcfa(charge.amount)}
            {charge.status === "disputed" ? " — contestée par votre locataire" : " — en attente de validation"}.
            La version corrigée remplacera celle-ci et repartira pour validation avec un nouveau
            lien. L&apos;ancienne reste lisible dans l&apos;historique.
          </p>
        </div>

        {charge.status === "disputed" && charge.contest_nature === "amount" && charge.contested_amount != null ? (
          <p className="rounded-2xl border border-warning/50 bg-warning/10 px-5 py-4 text-sm text-warning">
            Votre locataire reconnaît {formatFcfa(charge.contested_amount)}.
          </p>
        ) : null}

        {sp?.error ? (
          <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {sp.error}
          </p>
        ) : null}

        <form action={replaceLedgerCharge} className="space-y-6">
          <input type="hidden" name="lease_id" value={lease.id} />
          <input type="hidden" name="id" value={charge.id} />

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
              defaultValue={charge.label}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="amount" className="text-sm font-medium text-foreground">
              Montant corrigé (FCFA)
            </label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="numeric"
              required
              defaultValue={charge.amount}
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
              defaultValue={charge.due_date ?? undefined}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="reason" className="text-sm font-medium text-foreground">
              Motif de la correction <span className="font-normal text-muted-foreground">(facultatif, reste dans l&apos;historique)</span>
            </label>
            <input
              id="reason"
              name="reason"
              type="text"
              maxLength={200}
              placeholder="Ex. erreur de saisie sur le montant"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <SubmitButton
            className="inline-flex w-full justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60"
            pendingLabel="Correction…"
          >
            Remplacer la charge
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
