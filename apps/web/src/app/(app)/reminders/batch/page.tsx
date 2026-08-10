import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requireLandlordProfile } from "@/lib/landlords"
import { getReminderBatch } from "@/lib/reminders/queries"
import { ReminderBatch } from "./reminder-batch"

// File de relance du portefeuille : toutes les échéances non soldées dont la
// date approche ou est dépassée, en une passe. L'écran d'origine (/reminders)
// garde les réglages et l'historique.

export default function ReminderBatchPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/reminders"
        className="inline-flex items-center gap-1 text-sm text-foreground/70 underline-offset-4 hover:underline"
      >
        <ChevronLeft size={16} />
        Relances
      </Link>

      <header className="mt-4 space-y-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground lg:text-3xl">
          File de relance
        </h1>
        <p className="text-sm leading-6 text-foreground/70">
          Les échéances à relancer, avec un message pré-rédigé par ligne. Vous les
          ouvrez une à une dans WhatsApp et envoyez vous-même.
        </p>
      </header>

      <Suspense fallback={<BatchSkeleton />}>
        <BatchData />
      </Suspense>
    </main>
  )
}

async function BatchData() {
  const landlord = await requireLandlordProfile()
  const rows = await getReminderBatch(landlord.id)

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-6 text-center">
        <p className="text-sm font-medium text-foreground">Rien à relancer.</p>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          Aucune échéance impayée dont la date approche ou est dépassée.
        </p>
      </div>
    )
  }

  return <ReminderBatch rows={rows} />
}

function BatchSkeleton() {
  return (
    <div aria-busy className="mt-6 space-y-4">
      <div className="h-64 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      <p className="sr-only">Chargement…</p>
    </div>
  )
}
