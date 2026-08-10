import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { ImportWizard } from "./import-wizard"

export default async function ImportPage() {
  await requireLandlordProfile()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Import du portefeuille</p>
        </div>
        <Link
          href="/properties"
          className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
        >
          Vos lieux
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-6 py-12">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-4xl">
          Chargez votre portefeuille
        </h1>

        <ImportWizard />
      </section>
    </main>
  )
}
