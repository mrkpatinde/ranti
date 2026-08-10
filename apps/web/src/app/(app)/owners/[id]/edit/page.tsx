import Link from "next/link"
import { notFound } from "next/navigation"
import { Alert } from "@/components/ui/alert"
import { requireLandlordProfile } from "@/lib/landlords"
import { getOwner, updateOwner } from "@/lib/owners"
import { OwnerForm } from "../../owner-form"

type EditOwnerPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}

export default async function EditOwnerPage({ params, searchParams }: EditOwnerPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const owner = await getOwner(landlord.id, id)

  if (!owner) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Modifier le propriétaire</p>
        </div>
        <Link
          href={`/owners/${owner.id}`}
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-4xl">
            {owner.display_name}
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Le taux d&apos;honoraires s&apos;applique au loyer encaissé du mois en cours.
          </p>
        </div>

        {sp?.error ? <Alert variant="error">{sp.error}</Alert> : null}

        <OwnerForm action={updateOwner} owner={owner} submitLabel="Enregistrer" />
      </section>
    </main>
  )
}
