import Link from "next/link"
import { Alert } from "@/components/ui/alert"
import { requireLandlordProfile } from "@/lib/landlords"
import { createOwner } from "@/lib/owners"
import { OwnerForm } from "../owner-form"

type NewOwnerPageProps = {
  searchParams?: Promise<{ error?: string }>
}

export default async function NewOwnerPage({ searchParams }: NewOwnerPageProps) {
  await requireLandlordProfile()
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Nouveau propriétaire</p>
        </div>
        <Link
          href="/owners"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Retour
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground lg:text-4xl">
            Ajouter un propriétaire
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Il ne se connecte pas à Ranti : vous gérez ses lots, il reçoit son relevé.
          </p>
        </div>

        {params?.error ? <Alert variant="error">{params.error}</Alert> : null}

        <OwnerForm action={createOwner} submitLabel="Enregistrer" />
      </section>
    </main>
  )
}
